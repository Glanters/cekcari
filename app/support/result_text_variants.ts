import { addressOf } from '#support/site_address'

/**
 * Variasi judul & deskripsi untuk situs mirror: banyak link (mis. depobos45.com, depobos19.com)
 * memasang meta tag yang persis sama, sehingga hasil pencarian tampak berulang. Situs tertua dalam
 * kelompok yang sama tetap memakai teks aslinya; situs berikutnya mendapat variasi ke-1, ke-2, dst.
 * Variasi selalu memuat alamat link itu sendiri sehingga tidak pernah sama, dan sengaja tidak
 * menambah klaim (mis. "resmi", "terpercaya") yang tidak ditulis pemilik situs.
 */

export type VariantSource = { url: string; title: string; description: string }

type Template = (brand: string, address: string) => string

const TITLE_TEMPLATES: Template[] = [
    (brand, address) => `${brand} — Link Alternatif ${address}`,
    (brand, address) => `${address} | ${brand}`,
    (brand, address) => `Akses ${brand} lewat ${address}`,
    (brand, address) => `Link ${brand}: ${address}`,
    (brand, address) => `${brand} di ${address}`,
]

const DESCRIPTION_LEADS: Template[] = [
    (brand, address) => `Link alternatif ${brand} di ${address}.`,
    (brand, address) => `${address} adalah salah satu alamat ${brand}.`,
    (brand, address) => `Buka ${brand} melalui ${address}.`,
    (brand, address) => `Alamat ${brand} lainnya: ${address}.`,
]

const MIN_BRAND_LENGTH = 3

function wordsOf(text: string): string[] {
    return text.match(/[\p{L}\p{N}]+/gu) ?? []
}

/**
 * Nama merek = kata pertama di judul yang juga muncul di alamat link (DEPOBOS pada depobos45.com),
 * ditulis seperti di judul. Bila tidak ada, dipakai nama host tanpa angka di belakangnya.
 */
export function brandOf(source: VariantSource): string {
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

    return hostBrand.charAt(0).toUpperCase() + hostBrand.slice(1)
}

// variant dimulai dari 1 (0 = teks asli situs tertua di kelompoknya).
function pick<T>(items: T[], variant: number): T {
    return items[(variant - 1) % items.length]
}

export function variantTitle(source: VariantSource, variant: number): string {
    return pick(TITLE_TEMPLATES, variant)(brandOf(source), addressOf(source.url))
}

/**
 * Kalimat pembuka variasi + satu kalimat dari deskripsi asli (bergiliran), agar isi aslinya tetap terbaca.
 */
export function variantDescription(source: VariantSource, variant: number): string {
    const lead = pick(DESCRIPTION_LEADS, variant)(brandOf(source), addressOf(source.url))
    const sentences = source.description
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0)

    if (sentences.length === 0) {
        return lead
    }

    return `${lead} ${pick(sentences, variant)}`
}
