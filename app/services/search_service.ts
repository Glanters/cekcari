import db from '@adonisjs/lucid/services/db'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Domain from '#models/domain'
import SpellingCorrector from '#services/spelling_corrector'
import { variantDescription, variantTags, variantTitle } from '#support/result_text_variants'

// Penanda sorotan sengaja bukan tag HTML agar frontend tidak perlu merender HTML mentah.
export const HIGHLIGHT_START = '⟦'
export const HIGHLIGHT_END = '⟧'

/**
 * Kata kunci 3 huruf atau lebih juga cocok dengan kata yang diawalinya: "jutawan" menemukan
 * "jutawanbet" dan host "jutawan81605.com". Setiap leksem hasil websearch_to_tsquery ('kata') diberi
 * ":*"; kata yang lebih pendek tetap harus sama persis agar "a" tidak cocok dengan semua situs.
 */
const TS_QUERY =
    "to_tsquery('simple', regexp_replace(websearch_to_tsquery('simple', ?)::text," +
    String.raw` '''(([^'']|''''){3,})''', '''\1'':*', 'g'))`
const FUZZY_THRESHOLD = 0.4
// Jalan terakhir hanya menampilkan situs yang paling mirip, bukan semua situs yang kebetulan berbagi
// satu kata umum (mis. ratusan situs bernama "togel ..." untuk pencarian "togel onlen").
const FUZZY_MAX_RESULTS = 30
const FUZZY_MAX_WORDS = 6
const FUZZY_MIN_WORD_LENGTH = 3
const MAX_RELATED_PAGES = 3
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}`

type DomainQuery = ModelQueryBuilderContract<typeof Domain, Domain>

export type RelatedPage = { url: string; title: string | null; snippet: string }

export type SearchHit = {
    domain: Domain
    titleHighlight: string
    descriptionHighlight: string
    // Nama tag sesuai urutan tampil (digeser untuk situs mirror).
    tags: string[]
    relatedPages: RelatedPage[]
}

export type SearchOutcome = {
    hits: SearchHit[]
    promoted: SearchHit | null
    isFuzzy: boolean
    // Kata kunci hasil koreksi salah ketik yang hasilnya sedang ditampilkan, atau null.
    correctedQuery: string | null
    pagination: { page: number; per_page: number; total: number; last_page: number }
}

type HeadlineRow = { id: number; title_highlight: string; description_highlight: string }

type DuplicateRankRow = { id: number; title_rank: number; description_rank: number }

type DisplayText = { id: number; title: string; description: string; tags: string[] }

type RelatedPageRow = { domain_id: number; url: string; title: string | null; snippet: string }

export type SearchOptions = {
    // false bila pengunjung memilih "cari persis yang saya ketik".
    allowCorrection?: boolean
}

// Kata pendek (mis. "di", "ke") terlalu banyak miripnya; dipakai hanya bila tidak ada kata lain.
function fuzzyWords(keyword: string): string[] {
    const words = (keyword.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, FUZZY_MAX_WORDS)
    const meaningfulWords = words.filter((word) => word.length >= FUZZY_MIN_WORD_LENGTH)

    if (meaningfulWords.length > 0) {
        return meaningfulWords
    }

    return words.length > 0 ? words : [keyword]
}

export default class SearchService {
    private readonly corrector = new SpellingCorrector()

    /**
     * Mencari domain yang cocok. Bila seed diisi (dikirim per pengunjung), urutan hasil diacak
     * secara tetap untuk seed itu, sehingga link yang sama tidak selalu di atas tetapi pindah halaman
     * tetap konsisten. Satu link bertanda promosi yang cocok dipilih acak untuk slot teratas dan
     * tidak diulang di daftar biasa.
     */
    async search(
        keyword: string,
        page: number,
        perPage: number,
        seed: number | null = null,
        options: SearchOptions = {}
    ): Promise<SearchOutcome> {
        let matches = this.fullTextQuery(keyword)
        let effectiveKeyword = keyword
        let correctedQuery: string | null = null
        let isFuzzy = false

        // Tanpa hasil persis: coba koreksi salah ketik dulu (seperti mesin pencari umum), baru
        // kemudian situs dengan nama mirip sebagai jalan terakhir.
        if (!(await this.hasAny(matches))) {
            const corrected =
                options.allowCorrection === false ? null : await this.corrector.correct(keyword)
            const correctedMatches = corrected ? this.fullTextQuery(corrected) : null

            if (corrected && correctedMatches && (await this.hasAny(correctedMatches))) {
                matches = correctedMatches
                effectiveKeyword = corrected
                correctedQuery = corrected
            } else {
                matches = this.fuzzyQuery(keyword)
                isFuzzy = true
            }
        }

        const promoted = await this.pickPromoted(matches.clone(), seed)

        const listing = this.applyOrder(matches, seed).preload('tags')

        if (promoted) {
            listing.whereNot('domains.id', promoted.id)
        }

        const paginator = await listing.paginate(page, perPage)
        const pageDomains = paginator.all()
        const hits = await this.attachHighlights(
            promoted ? [...pageDomains, promoted] : pageDomains,
            effectiveKeyword
        )

        return {
            hits: promoted ? hits.slice(0, -1) : hits,
            promoted: promoted ? hits[hits.length - 1] : null,
            isFuzzy,
            correctedQuery,
            pagination: {
                page: paginator.currentPage,
                per_page: paginator.perPage,
                total: Number(paginator.total),
                last_page: paginator.lastPage,
            },
        }
    }

    /**
     * Skor = kecocokan data situs (judul, host, deskripsi) + kecocokan halaman hasil crawl terbaik + kecocokan tag.
     */
    private fullTextQuery(keyword: string): DomainQuery {
        return this.baseQuery()
            .joinRaw(
                'LEFT JOIN (' +
                    `SELECT domain_id, max(ts_rank(search_vector, ${TS_QUERY})) AS page_rank FROM pages` +
                    ` WHERE search_vector @@ ${TS_QUERY} GROUP BY domain_id` +
                    ') AS page_hits ON page_hits.domain_id = domains.id',
                [keyword, keyword]
            )
            .joinRaw(
                'LEFT JOIN (' +
                    'SELECT domain_tag.domain_id, count(*) AS tag_matches FROM domain_tag' +
                    ' INNER JOIN tags ON tags.id = domain_tag.tag_id' +
                    ` WHERE to_tsvector('simple', tags.name) @@ ${TS_QUERY} GROUP BY domain_tag.domain_id` +
                    ') AS tag_hits ON tag_hits.domain_id = domains.id',
                [keyword]
            )
            .where((query) => {
                query
                    .whereRaw(`domains.search_vector @@ ${TS_QUERY}`, [keyword])
                    .orWhereNotNull('page_hits.domain_id')
                    .orWhereNotNull('tag_hits.domain_id')
            })
            .select(
                db.raw(
                    `ts_rank(domains.search_vector, ${TS_QUERY})` +
                        ' + coalesce(page_hits.page_rank, 0) * 0.5' +
                        ' + coalesce(tag_hits.tag_matches, 0) * 0.3 AS score,' +
                        // 0 = data situs sendiri (judul, host, deskripsi, tag) cocok; 1 = hanya isi halamannya.
                        ` CASE WHEN domains.search_vector @@ ${TS_QUERY} OR tag_hits.domain_id IS NOT NULL` +
                        ' THEN 0 ELSE 1 END AS match_tier',
                    [keyword, keyword]
                )
            )
    }

    // Dipakai bila pencarian persis tidak menemukan apa pun, misalnya karena salah ketik.
    /**
     * Setiap kata kunci harus mirip dengan salah satu kata di judul atau alamat situs; skor adalah
     * rata-rata kemiripan semua kata. Hanya FUZZY_MAX_RESULTS situs termirip yang diambil.
     */
    private fuzzyQuery(keyword: string): DomainQuery {
        const words = fuzzyWords(keyword)
        const wordSimilarity =
            'greatest(word_similarity(?, domains.title), word_similarity(?, domains.host))'
        const score = `(${words.map(() => wordSimilarity).join(' + ')}) / ${words.length}`
        const scoreBindings = words.flatMap((word) => [word, word])

        const closest = this.baseQuery().clearSelect().select('domains.id')

        for (const word of words) {
            closest.whereRaw(`${wordSimilarity} > ?`, [word, word, FUZZY_THRESHOLD])
        }

        closest
            .orderByRaw(`${score} DESC`, scoreBindings)
            .orderBy('domains.id', 'asc')
            .limit(FUZZY_MAX_RESULTS)

        return this.baseQuery()
            .whereIn('domains.id', closest)
            .select(db.raw(`${score} AS score, 0 AS match_tier`, scoreBindings))
    }

    /**
     * Situs yang data dirinya cocok selalu di atas situs yang cocok hanya lewat isi halamannya.
     * Tanpa seed (mis. pemanggil API langsung) hasil lalu diurutkan menurut kecocokan.
     */
    private applyOrder(matches: DomainQuery, seed: number | null): DomainQuery {
        const tiered = matches.orderBy('match_tier', 'asc')

        if (seed === null) {
            return tiered.orderBy('score', 'desc').orderBy('domains.id', 'asc')
        }

        return tiered
            .orderByRaw('md5(domains.id::text || ?)', [String(seed)])
            .orderBy('domains.id', 'asc')
    }

    // Garam "promo" membuat pilihan promosi tidak sekadar mengikuti urutan acak daftar biasa.
    private async pickPromoted(matches: DomainQuery, seed: number | null): Promise<Domain | null> {
        const promotedMatches = matches.where('domains.is_promoted', true).preload('tags')

        if (seed === null) {
            return promotedMatches.orderByRaw('random()').first()
        }

        return promotedMatches
            .orderByRaw("md5('promo' || domains.id::text || ?)", [String(seed)])
            .first()
    }

    private async hasAny(matches: DomainQuery): Promise<boolean> {
        const probe = await matches.clone().clearSelect().select('domains.id').limit(1).pojo()

        return probe.length > 0
    }

    private baseQuery(): DomainQuery {
        return Domain.query()
            .withScopes((scopes) => scopes.active())
            .select('domains.*')
    }

    /**
     * Menambahkan judul/deskripsi bersorot dan maksimal 3 halaman terkait untuk setiap domain di halaman ini.
     */
    private async attachHighlights(domains: Domain[], keyword: string): Promise<SearchHit[]> {
        if (domains.length === 0) {
            return []
        }

        const domainIds = domains.map((domain) => domain.id)
        const fullTextOptions = `${HEADLINE_OPTIONS}, HighlightAll=true`
        const displayTexts = await this.displayTexts(domains)

        // Sorotan dibuat dari teks yang benar-benar ditampilkan (asli atau variasi mirror).
        // Deskripsi dikirim utuh (dipotong rapi di tampilan), karena potongan ts_headline
        // bisa mulai di tengah kalimat.
        const headlineResult = await db.rawQuery<{ rows: HeadlineRow[] }>(
            `SELECT id,` +
                ` ts_headline('simple', title, ${TS_QUERY}, ?) AS title_highlight,` +
                ` ts_headline('simple', description, ${TS_QUERY}, ?) AS description_highlight` +
                ` FROM (VALUES ${displayTexts.map(() => '(?::bigint, ?::text, ?::text)').join(', ')})` +
                ' AS texts (id, title, description)',
            [
                keyword,
                fullTextOptions,
                keyword,
                fullTextOptions,
                ...displayTexts.flatMap((text) => [text.id, text.title, text.description]),
            ]
        )
        const headlineRows = headlineResult.rows
        // Driver pg mengembalikan kolom bigint sebagai string, jadi kunci peta diseragamkan ke number.
        const headlines = new Map(headlineRows.map((row) => [Number(row.id), row]))

        // Halaman utama sudah diwakili kartu domain itu sendiri, jadi tidak diulang sebagai halaman terkait.
        const rankedPages = db
            .from('pages')
            .join('domains', 'domains.id', 'pages.domain_id')
            .whereIn('pages.domain_id', domainIds)
            .whereRaw("pages.url NOT IN (domains.url, domains.url || '/')")
            .whereRaw(`pages.search_vector @@ ${TS_QUERY}`, [keyword])
            .select(
                'pages.domain_id',
                'pages.url',
                'pages.title',
                db.raw(
                    `ts_headline('simple', coalesce(pages.content, pages.description, ''), ${TS_QUERY}, ?) AS snippet,` +
                        ` row_number() OVER (PARTITION BY pages.domain_id ORDER BY ts_rank(pages.search_vector, ${TS_QUERY}) DESC) AS position`,
                    [
                        keyword,
                        `${HEADLINE_OPTIONS}, MaxWords=30, MinWords=12, MaxFragments=1`,
                        keyword,
                    ]
                )
            )

        const relatedPageRows: RelatedPageRow[] = await db
            .query()
            .from(rankedPages.as('ranked_pages'))
            .where('position', '<=', MAX_RELATED_PAGES)
            .orderBy('position')
            .select('domain_id', 'url', 'title', 'snippet')

        const relatedPages = new Map<number, RelatedPage[]>()

        for (const row of relatedPageRows) {
            const domainId = Number(row.domain_id)
            relatedPages.set(domainId, [
                ...(relatedPages.get(domainId) ?? []),
                { url: row.url, title: row.title, snippet: row.snippet },
            ])
        }

        return domains.map((domain, index) => {
            const headline = headlines.get(Number(domain.id))

            return {
                domain,
                titleHighlight: headline?.title_highlight ?? displayTexts[index].title,
                descriptionHighlight:
                    headline?.description_highlight ?? displayTexts[index].description,
                tags: displayTexts[index].tags,
                relatedPages: relatedPages.get(Number(domain.id)) ?? [],
            }
        })
    }

    /**
     * Judul & deskripsi yang ditampilkan. Situs yang judul (atau deskripsinya) sama persis dengan
     * situs aktif lain yang lebih dulu terdaftar mendapat variasi berurutan (lihat result_text_variants),
     * supaya situs mirror tidak tampil berulang dengan teks yang sama. Data di database tidak diubah.
     */
    private async displayTexts(domains: Domain[]): Promise<DisplayText[]> {
        const normalize = (text: string) => text.trim().toLowerCase()
        const titles = [...new Set(domains.map((domain) => normalize(domain.title)))]
        const descriptions = [
            ...new Set(domains.map((domain) => normalize(domain.description ?? ''))),
        ].filter((description) => description.length > 0)
        const placeholders = (values: string[]) => values.map(() => '?').join(', ')

        // Setiap situs dengan judul/deskripsi yang sama pasti ikut terambil oleh filter ini,
        // jadi urutan di dalam kelompoknya (row_number) lengkap.
        const sameTextDomains = Domain.query()
            .withScopes((scopes) => scopes.active())
            .where((query) => {
                query.whereRaw(`lower(btrim(domains.title)) IN (${placeholders(titles)})`, titles)

                if (descriptions.length > 0) {
                    query.orWhereRaw(
                        `lower(btrim(domains.description)) IN (${placeholders(descriptions)})`,
                        descriptions
                    )
                }
            })
            .select(
                'domains.id',
                db.raw(
                    'row_number() OVER (PARTITION BY lower(btrim(domains.title)) ORDER BY domains.id) - 1 AS title_rank'
                ),
                db.raw(
                    'row_number() OVER (PARTITION BY lower(btrim(domains.description)) ORDER BY domains.id) - 1 AS description_rank'
                )
            )

        const rankRows: DuplicateRankRow[] = await db
            .query()
            .from(sameTextDomains.as('same_text_domains'))
            .whereIn(
                'id',
                domains.map((domain) => domain.id)
            )
            .select('id', 'title_rank', 'description_rank')
        const ranks = new Map(rankRows.map((row) => [Number(row.id), row]))

        return domains.map((domain) => {
            const rank = ranks.get(Number(domain.id))
            const tagNames = domain.tags.map((tag) => tag.name)
            const source = {
                url: domain.url,
                title: domain.title,
                description: domain.description ?? '',
                tags: tagNames,
            }
            const titleRank = Number(rank?.title_rank ?? 0)
            const descriptionRank = Number(rank?.description_rank ?? 0)

            return {
                id: Number(domain.id),
                title: titleRank > 0 ? variantTitle(source, titleRank) : domain.title,
                description:
                    descriptionRank > 0 && source.description.trim().length > 0
                        ? variantDescription(source, descriptionRank)
                        : domain.description,
                tags: titleRank > 0 ? variantTags(tagNames, titleRank) : tagNames,
            }
        })
    }
}
