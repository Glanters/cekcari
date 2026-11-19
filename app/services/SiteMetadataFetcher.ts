import { inject } from '@adonisjs/core'
import { RemoteFetchException, SiteRedirectedException } from '#exceptions/RemoteFetchException'
import HtmlExtractor, { type ExtractedHtml, type SiteIcons } from '#services/HtmlExtractor'
import RemotePageFetcher from '#services/RemotePageFetcher'
import { countChars, sliceChars } from '#support/characters'
import { hostOf, isSameSite } from '#support/siteAddress'

export type SiteMetadata = {
    title: string
    description: string
    tags: string[]
    icons: SiteIcons
}

export const MAX_TITLE_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 1000
export const MAX_TAGS = 10
export const MAX_TAG_LENGTH = 40
// Tag yang layak: diawali huruf/angka, sisanya huruf, angka, spasi, atau "-". Berlaku juga untuk tag isian pemilik.
export const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s-]*$/u
// Panjang cuplikan isi halaman bila situs tidak punya meta description.
const FALLBACK_DESCRIPTION_LENGTH = 300

/**
 * Mengambil identitas situs (judul, deskripsi, tag, ikon) dari halaman yang didaftarkan,
 * karena pemilik domain hanya mengisi link.
 */
@inject()
export default class SiteMetadataFetcher {
    constructor(
        private readonly fetcher: RemotePageFetcher,
        private readonly extractor: HtmlExtractor
    ) {}

    async fetch(siteUrl: string, host: string): Promise<SiteMetadata> {
        const page = await this.fetcher.fetch(siteUrl)

        // Link pengalih (mis. dkwl.b-cdn.net/nama-kl1) ke situs yang menolak pembaca otomatis tetap
        // link yang sah; laporkan tujuannya, jangan dianggap situs mati.
        const isUnreadable = page.isBlocked() || (page.isSuccessful() && !page.isHtml())

        if (isUnreadable && !isSameSite(page.url, host)) {
            throw new SiteRedirectedException(page.url)
        }

        if (!page.isSuccessful()) {
            throw new RemoteFetchException(
                `Situs tidak dapat dibuka (kode ${page.status}). Pastikan link benar dan situs sedang aktif.`
            )
        }

        if (!page.isHtml()) {
            throw new RemoteFetchException(
                'Link tidak mengarah ke halaman web. Isi dengan alamat halaman situs, misalnya psms.id.'
            )
        }

        const extracted = this.extractor.extract(page.text(), page.url)

        return {
            title: sliceChars(extracted.title ?? host, MAX_TITLE_LENGTH),
            description: this.description(extracted),
            tags: this.tags(extracted.keywords),
            icons: extracted.icons,
        }
    }

    /**
     * Data pengganti untuk link pengalih yang tujuannya tidak bisa dibaca: judul dari path link
     * (mis. "/d/indrabet-kl2/register" menjadi "indrabet-kl2 / register") agar tetap bisa dicari.
     */
    forRedirectLink(linkUrl: string, targetUrl: string): SiteMetadata {
        const targetHost = URL.parse(targetUrl)?.hostname.toLowerCase() ?? hostOf(linkUrl)
        const pathWords = new URL(linkUrl).pathname
            .split('/')
            .map((segment) => this.decodedSegment(segment).replaceAll('_', ' ').trim())
            .filter((segment) => countChars(segment) > 1)

        return {
            title: sliceChars(
                pathWords.length > 0 ? pathWords.join(' / ') : targetHost,
                MAX_TITLE_LENGTH
            ),
            description: `Link menuju ${targetHost}.`,
            tags: [],
            icons: { faviconUrl: null, touchIconUrl: null },
        }
    }

    // Path yang encodingnya rusak dipakai apa adanya daripada menggagalkan pendaftaran link.
    private decodedSegment(segment: string): string {
        try {
            return decodeURIComponent(segment)
        } catch {
            return segment
        }
    }

    private description(extracted: ExtractedHtml): string {
        if (extracted.description !== null) {
            return sliceChars(extracted.description, MAX_DESCRIPTION_LENGTH)
        }

        if (countChars(extracted.text) <= FALLBACK_DESCRIPTION_LENGTH) {
            return extracted.text
        }

        return `${sliceChars(extracted.text, FALLBACK_DESCRIPTION_LENGTH).trimEnd()}…`
    }

    // Hanya kata kunci yang layak dijadikan tag: diawali huruf/angka dan tidak terlalu panjang.
    private tags(keywords: string[]): string[] {
        return keywords
            .filter((keyword) => countChars(keyword) <= MAX_TAG_LENGTH && TAG_PATTERN.test(keyword))
            .slice(0, MAX_TAGS)
    }
}
