<?php

namespace App\Services;

use App\Models\Domain;
use App\Support\LikePattern;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SearchService
{
    // Penanda sorotan sengaja bukan tag HTML agar frontend tidak perlu merender HTML mentah.
    public const HIGHLIGHT_START = '⟦';

    public const HIGHLIGHT_END = '⟧';

    private const TS_QUERY = "websearch_to_tsquery('simple', ?)";

    private const FUZZY_THRESHOLD = 0.4;

    private const MAX_RELATED_PAGES = 3;

    /**
     * Mencari domain yang cocok. Bila $seed diisi (dikirim per pengunjung), urutan hasil diacak
     * secara tetap untuk seed itu, sehingga link yang sama tidak selalu di atas tetapi pindah halaman
     * tetap konsisten. Satu link bertanda promosi yang cocok dipilih acak untuk slot teratas dan
     * tidak diulang di daftar biasa.
     *
     * @return array{paginator: LengthAwarePaginator, isFuzzy: bool, promoted: ?Domain}
     */
    public function search(string $keyword, int $page, int $perPage, ?int $seed = null): array
    {
        $matches = $this->fullTextQuery($keyword);
        $isFuzzy = false;

        if (! (clone $matches)->exists()) {
            $matches = $this->fuzzyQuery($keyword);
            $isFuzzy = true;
        }

        $promoted = $this->pickPromoted(clone $matches, $seed);

        $paginator = $this->applyOrder($matches, $seed)
            ->when($promoted, fn (Builder $query) => $query->whereKeyNot($promoted->id))
            ->paginate($perPage, ['*'], 'page', $page);

        $this->attachHighlights(
            $paginator->getCollection()->when($promoted, fn (Collection $domains) => $domains->concat([$promoted])),
            $keyword,
        );

        return ['paginator' => $paginator, 'isFuzzy' => $isFuzzy, 'promoted' => $promoted];
    }

    /**
     * @return list<string>
     */
    public function suggest(string $keyword, int $limit = 6): array
    {
        $prefixPattern = LikePattern::startsWith($keyword);

        $domainTitles = Domain::query()
            ->where(fn (Builder $query) => $query
                ->whereLike('title', $prefixPattern)
                ->orWhereRaw('word_similarity(?, title) > ?', [$keyword, self::FUZZY_THRESHOLD]))
            ->orderByRaw('word_similarity(?, title) DESC', [$keyword])
            ->limit($limit)
            ->pluck('title');

        $tagNames = DB::table('tags')
            ->whereExists(fn ($query) => $query->select(DB::raw(1))
                ->from('domain_tag')
                ->join('domains', 'domains.id', '=', 'domain_tag.domain_id')
                ->whereColumn('domain_tag.tag_id', 'tags.id')
                ->whereNull('domains.deleted_at'))
            ->where(fn ($query) => $query
                ->whereLike('name', $prefixPattern)
                ->orWhereRaw('word_similarity(?, name) > ?', [$keyword, self::FUZZY_THRESHOLD]))
            ->orderByRaw('word_similarity(?, name) DESC', [$keyword])
            ->limit($limit)
            ->pluck('name');

        return $domainTitles->merge($tagNames)
            ->unique(fn (string $suggestion) => mb_strtolower($suggestion))
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * Skor = kecocokan data situs (judul, host, deskripsi) + kecocokan halaman hasil crawl terbaik + kecocokan tag.
     */
    private function fullTextQuery(string $keyword): Builder
    {
        $pageHits = DB::table('pages')
            ->selectRaw('domain_id, max(ts_rank(search_vector, '.self::TS_QUERY.')) AS page_rank', [$keyword])
            ->whereRaw('search_vector @@ '.self::TS_QUERY, [$keyword])
            ->groupBy('domain_id');

        $tagHits = DB::table('domain_tag')
            ->join('tags', 'tags.id', '=', 'domain_tag.tag_id')
            ->selectRaw('domain_tag.domain_id, count(*) AS tag_matches')
            ->whereRaw("to_tsvector('simple', tags.name) @@ ".self::TS_QUERY, [$keyword])
            ->groupBy('domain_tag.domain_id');

        return $this->baseQuery()
            ->leftJoinSub($pageHits, 'page_hits', 'page_hits.domain_id', '=', 'domains.id')
            ->leftJoinSub($tagHits, 'tag_hits', 'tag_hits.domain_id', '=', 'domains.id')
            ->where(fn (Builder $query) => $query
                ->whereRaw('domains.search_vector @@ '.self::TS_QUERY, [$keyword])
                ->orWhereNotNull('page_hits.domain_id')
                ->orWhereNotNull('tag_hits.domain_id'))
            ->selectRaw(
                'ts_rank(domains.search_vector, '.self::TS_QUERY.')'
                .' + coalesce(page_hits.page_rank, 0) * 0.5'
                .' + coalesce(tag_hits.tag_matches, 0) * 0.3 AS score',
                [$keyword],
            );
    }

    // Dipakai bila pencarian persis tidak menemukan apa pun, misalnya karena salah ketik.
    private function fuzzyQuery(string $keyword): Builder
    {
        $similarity = 'greatest(word_similarity(?, domains.title), word_similarity(?, domains.host))';

        return $this->baseQuery()
            ->whereRaw($similarity.' > ?', [$keyword, $keyword, self::FUZZY_THRESHOLD])
            ->selectRaw($similarity.' AS score', [$keyword, $keyword]);
    }

    // Tanpa seed (mis. pemanggil API langsung) hasil diurutkan menurut kecocokan.
    private function applyOrder(Builder $matches, ?int $seed): Builder
    {
        if ($seed === null) {
            return $matches->orderByDesc('score')->orderBy('domains.id');
        }

        return $matches->orderByRaw('md5(domains.id::text || ?)', [(string) $seed])->orderBy('domains.id');
    }

    // Garam "promo" membuat pilihan promosi tidak sekadar mengikuti urutan acak daftar biasa.
    private function pickPromoted(Builder $matches, ?int $seed): ?Domain
    {
        $promotedMatches = $matches->where('domains.is_promoted', true);

        return ($seed === null
            ? $promotedMatches->inRandomOrder()
            : $promotedMatches->orderByRaw("md5('promo' || domains.id::text || ?)", [(string) $seed])
        )->first();
    }

    private function baseQuery(): Builder
    {
        return Domain::query()
            ->select('domains.*')
            ->with('tags');
    }

    /**
     * Menambahkan judul/deskripsi bersorot dan maksimal 3 halaman terkait untuk setiap domain di halaman ini.
     *
     * @param  Collection<int, Domain>  $domains
     */
    private function attachHighlights(Collection $domains, string $keyword): void
    {
        if ($domains->isEmpty()) {
            return;
        }

        $domainIds = $domains->pluck('id')->all();
        $headlineOptions = 'StartSel='.self::HIGHLIGHT_START.', StopSel='.self::HIGHLIGHT_END;

        $domainHeadlines = DB::table('domains')
            ->whereIn('id', $domainIds)
            ->selectRaw(
                'id, ts_headline(\'simple\', title, '.self::TS_QUERY.', ?) AS title_highlight,'
                .' ts_headline(\'simple\', description, '.self::TS_QUERY.', ?) AS description_highlight',
                // Deskripsi dikirim utuh (dipotong rapi di tampilan), karena potongan ts_headline
                // bisa mulai di tengah kalimat.
                [$keyword, $headlineOptions.', HighlightAll=true', $keyword, $headlineOptions.', HighlightAll=true'],
            )
            ->get()
            ->keyBy('id');

        // Halaman utama sudah diwakili kartu domain itu sendiri, jadi tidak diulang sebagai halaman terkait.
        $rankedPages = DB::table('pages')
            ->join('domains', 'domains.id', '=', 'pages.domain_id')
            ->whereIn('pages.domain_id', $domainIds)
            ->whereRaw("pages.url NOT IN (domains.url, domains.url || '/')")
            ->whereRaw('pages.search_vector @@ '.self::TS_QUERY, [$keyword])
            ->selectRaw(
                'pages.domain_id, pages.url, pages.title,'
                .' ts_headline(\'simple\', coalesce(pages.content, pages.description, \'\'), '.self::TS_QUERY.', ?) AS snippet,'
                .' row_number() OVER (PARTITION BY pages.domain_id ORDER BY ts_rank(pages.search_vector, '.self::TS_QUERY.') DESC) AS position',
                [$keyword, $headlineOptions.', MaxWords=30, MinWords=12, MaxFragments=1', $keyword],
            );

        $relatedPages = DB::query()
            ->fromSub($rankedPages, 'ranked_pages')
            ->where('position', '<=', self::MAX_RELATED_PAGES)
            ->orderBy('position')
            ->get()
            ->groupBy('domain_id');

        foreach ($domains as $domain) {
            $headline = $domainHeadlines->get($domain->id);
            $domain->setAttribute('title_highlight', $headline->title_highlight ?? $domain->title);
            $domain->setAttribute('description_highlight', $headline->description_highlight ?? $domain->description);
            $domain->setAttribute('related_pages', $relatedPages->get($domain->id, collect())->map(fn ($page) => [
                'url' => $page->url,
                'title' => $page->title,
                'snippet' => $page->snippet,
            ])->values()->all());
        }
    }
}
