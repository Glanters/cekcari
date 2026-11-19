import { addressOf } from '#support/siteAddress'

/**
 * Variasi judul, deskripsi, dan urutan tag untuk situs mirror: banyak link (mis. depobos45.com,
 * depobos19.com) memasang meta tag yang persis sama, sehingga hasil pencarian tampak berulang.
 * Situs tertua dalam kelompok yang sama tetap memakai teks aslinya; situs berikutnya mendapat
 * variasi ke-1, ke-2, dst. Variasi dirangkai dari nama merek, alamat link, kalimat deskripsi asli,
 * dan tag situs itu sendiri, sehingga tidak menambah klaim (mis. "resmi", "terpercaya") yang tidak
 * ditulis pemilik situs. Alamat link selalu ikut, jadi dua variasi tidak pernah sama persis.
 */

export type VariantSource = { url: string; title: string; description: string; tags: string[] }

type Template = (brand: string, address: string) => string

type TagTemplate = (phrase: string, address: string) => string

const TITLE_TEMPLATES: Template[] = [
    (brand, address) => `${brand} — Link Alternatif ${address}`,
    (brand, address) => `${address} | ${brand}`,
    (brand, address) => `Akses ${brand} lewat ${address}`,
    (brand, address) => `Link ${brand}: ${address}`,
    (brand, address) => `${brand} di ${address}`,
    (brand, address) => `Alamat ${brand} ${address}`,
    (brand, address) => `${brand} via ${address}`,
    (brand, address) => `Masuk ${brand} dari ${address}`,
    (brand, address) => `${address} — ${brand}`,
    (brand, address) => `Link Cadangan ${brand} (${address})`,
    (brand, address) => `${brand} · ${address}`,
    (brand, address) => `Buka ${brand} di ${address}`,
]

// Dirangkai dari tag situs (mis. "login depobos" menjadi "Login DEPOBOS di depobos45.com").
const TAG_TITLE_TEMPLATES: TagTemplate[] = [
    (phrase, address) => `${phrase} di ${address}`,
    (phrase, address) => `${address} — ${phrase}`,
    (phrase, address) => `${phrase} lewat ${address}`,
]

const DESCRIPTION_LEADS: Template[] = [
    (brand, address) => `Link alternatif ${brand} di ${address}.`,
    (brand, address) => `${address} adalah salah satu alamat ${brand}.`,
    (brand, address) => `Buka ${brand} melalui ${address}.`,
    (brand, address) => `Alamat ${brand} lainnya: ${address}.`,
    (brand, address) => `${brand} juga bisa dibuka lewat ${address}.`,
    (brand, address) => `Gunakan ${address} untuk mengakses ${brand}.`,
    (brand, address) => `Alamat ${address} membuka situs ${brand}.`,
    (brand, address) => `Satu lagi alamat ${brand}: ${address}.`,
    (brand, address) => `Link cadangan ${brand} tersedia di ${address}.`,
    (brand, address) => `Kunjungi ${brand} lewat alamat ${address}.`,
    (brand, address) => `${brand} versi ${address}.`,
    (brand, address) => `Masuk ke ${brand} dari ${address}.`,
]

const TAG_LINES: ((tags: string) => string)[] = [
    (tags) => `Terkait: ${tags}.`,
    (tags) => `Kata kunci: ${tags}.`,
    (tags) => `Tersedia untuk ${tags}.`,
]

/**
 * Susunan deskripsi: pembuka + kalimat asli, kalimat asli + pembuka, pembuka + tag,
 * atau pembuka + kalimat asli + tag. Bila situs tidak punya tag, bagian tag dilewati.
 */
type DescriptionParts = { lead: string; sentence: string | null; tagLine: string | null }

const DESCRIPTION_LAYOUTS: ((parts: DescriptionParts) => (string | null)[])[] = [
    ({ lead, sentence }) => [lead, sentence],
    ({ lead, sentence }) => [sentence, lead],
    ({ lead, sentence, tagLine }) => [lead, tagLine ?? sentence],
    ({ lead, sentence, tagLine }) => [lead, sentence, tagLine],
]

// Langkah pemilih tiap bagian sengaja berbeda (dan tidak berbagi faktor dengan jumlah pilihannya),
// supaya situs berurutan tidak memakai kombinasi pembuka/susunan/kalimat yang sama.
const LEAD_STEP = 5
const LAYOUT_STEP = 3
const SENTENCE_STEP = 7
const MIN_BRAND_LENGTH = 3
const MAX_TAGS_IN_LINE = 3

function wordsOf(text: string): string[] {
    return text.match(/[\p{L}\p{N}]+/gu) ?? []
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Nama merek = kata pertama di judul yang juga muncul di alamat link (DEPOBOS pada depobos45.com),
 * ditulis seperti di judul. Bila tidak ada, dipakai nama host tanpa angka di belakangnya.
 */
export function brandOf(source: Pick<VariantSource, 'url' | 'title'>): string {
    const compactAddress = wordsOf(addressOf(source.url).toLowerCase()).join('')
    const titleBrand = wordsOf(source.title).find(
        (word) => word.length >= MIN_BRAND_LENGTH && compactAddress.includes(word.toLowerCase())
    )

    if (titleBrand) {
        return titleBrand
    }

    const firstLabel = addressOf(source.url)
        .replace(/^www\./, '')
        .split(/[./]/)[0]
    const hostBrand = firstLabel.replace(/[\d-]+$/, '')

    if (hostBrand.length === 0) {
        return source.title.trim() || firstLabel
    }

    return capitalize(hostBrand)
}

// Tag ditulis dengan nama merek seperti di judul: "login depobos" menjadi "Login DEPOBOS".
function tagPhrases(source: VariantSource, brand: string): string[] {
    const brandPattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(brand)}(?![\\p{L}\\p{N}])`,
        'giu'
    )

    return source.tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => capitalize(tag.replace(brandPattern, brand)))
}

function sentencesOf(description: string): string[] {
    return description
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0)
}

// variant dimulai dari 1 (0 = teks asli situs tertua di kelompoknya).
function pick<T>(items: T[], variant: number, step = 1, offset = 0): T {
    return items[((variant - 1) * step + offset) % items.length]
}

export function variantTitle(source: VariantSource, variant: number): string {
    const brand = brandOf(source)
    const address = addressOf(source.url)
    const titles = [
        ...TITLE_TEMPLATES.map((template) => template(brand, address)),
        ...tagPhrases(source, brand).flatMap((phrase) =>
            TAG_TITLE_TEMPLATES.map((template) => template(phrase, address))
        ),
    ]

    return pick(titles, variant)
}

/**
 * Pembuka variasi dirangkai dengan satu kalimat dari deskripsi asli dan/atau tag situs (bergiliran),
 * agar isi aslinya tetap terbaca.
 */
export function variantDescription(source: VariantSource, variant: number): string {
    const brand = brandOf(source)
    const sentences = sentencesOf(source.description)
    const tags = variantTags(source.tags, variant).slice(0, MAX_TAGS_IN_LINE)
    const parts: DescriptionParts = {
        lead: pick(DESCRIPTION_LEADS, variant, LEAD_STEP)(brand, addressOf(source.url)),
        sentence: sentences.length > 0 ? pick(sentences, variant, SENTENCE_STEP, 1) : null,
        tagLine: tags.length > 0 ? pick(TAG_LINES, variant)(tags.join(', ')) : null,
    }
    // Setiap kali pembuka habis terpakai dan mulai berulang, susunannya ikut bergeser.
    const leadRound = Math.floor((variant - 1) / DESCRIPTION_LEADS.length)
    const layout = pick(DESCRIPTION_LAYOUTS, variant, LAYOUT_STEP, 1 + leadRound)

    return layout(parts)
        .filter((part): part is string => part !== null)
        .join(' ')
}

// Urutan tag digeser per variasi (tidak pernah sama dengan urutan asli); isinya tetap tag milik situs itu.
export function variantTags(tags: string[], variant: number): string[] {
    if (tags.length < 2) {
        return tags
    }

    const shift = ((variant - 1) % (tags.length - 1)) + 1

    return [...tags.slice(shift), ...tags.slice(0, shift)]
}
