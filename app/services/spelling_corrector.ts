import db from '@adonisjs/lucid/services/db'

// Kata yang terlalu pendek terlalu mudah "dikoreksi" menjadi kata lain, jadi dibiarkan apa adanya.
const MIN_CORRECTABLE_LENGTH = 3
const MAX_WORDS = 6
// Kemiripan trigram minimal agar sebuah kata dianggap salah ketik dari kata di kosakata.
const SIMILARITY_THRESHOLD = 0.4

/**
 * Kosakata = semua kata yang benar-benar ada di CekCari: judul, alamat, dan deskripsi situs yang
 * masih terdaftar, serta tag-nya. Koreksi tidak pernah menyarankan kata yang tidak ada di situs mana pun.
 */
const VOCABULARY_SQL = `
    SELECT word, nentry FROM ts_stat('SELECT search_vector FROM domains WHERE deleted_at IS NULL')
    UNION ALL
    SELECT word, nentry FROM ts_stat(
        'SELECT to_tsvector(''simple'', tags.name) FROM tags
         WHERE EXISTS (
             SELECT 1 FROM domain_tag
             JOIN domains ON domains.id = domain_tag.domain_id
             WHERE domain_tag.tag_id = tags.id AND domains.deleted_at IS NULL
         )'
    )
`

type CorrectionRow = { typed_word: string; is_known: boolean; candidate: string | null }

export function wordsOf(keyword: string): string[] {
    return (keyword.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_WORDS)
}

export default class SpellingCorrector {
    /**
     * Mengembalikan kata kunci yang sudah dikoreksi, atau null bila tidak ada yang perlu dikoreksi.
     * Hanya kata yang tidak ada di kosakata yang diganti; kata yang benar dibiarkan.
     */
    async correct(keyword: string): Promise<string | null> {
        const words = wordsOf(keyword)

        if (words.length === 0) {
            return null
        }

        // Satu placeholder per kata: knex mengembangkan array binding menjadi daftar, bukan array SQL.
        const typedWords = `ARRAY[${words.map(() => '?').join(', ')}]::text[]`
        const result = await db.rawQuery(
            `WITH vocabulary AS (${VOCABULARY_SQL}),
            typed AS (
                SELECT typed_word, position
                FROM unnest(${typedWords}) WITH ORDINALITY AS input(typed_word, position)
            )
            SELECT
                typed.typed_word,
                EXISTS (SELECT 1 FROM vocabulary WHERE vocabulary.word = typed.typed_word) AS is_known,
                (
                    SELECT vocabulary.word FROM vocabulary
                    WHERE similarity(vocabulary.word, typed.typed_word) > ?
                    ORDER BY similarity(vocabulary.word, typed.typed_word) DESC,
                        vocabulary.nentry DESC,
                        vocabulary.word ASC
                    LIMIT 1
                ) AS candidate
            FROM typed
            ORDER BY typed.position`,
            [...words, SIMILARITY_THRESHOLD]
        )

        const corrected = (result.rows as CorrectionRow[]).map((row) =>
            row.typed_word.length >= MIN_CORRECTABLE_LENGTH && !row.is_known && row.candidate
                ? row.candidate
                : row.typed_word
        )
        const correctedKeyword = corrected.join(' ')

        return correctedKeyword !== words.join(' ') ? correctedKeyword : null
    }
}
