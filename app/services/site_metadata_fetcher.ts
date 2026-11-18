import { inject } from '@adonisjs/core'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'
import HtmlExtractor, { type ExtractedHtml } from '#services/html_extractor'
import RemotePageFetcher from '#services/remote_page_fetcher'
import { countChars, sliceChars } from '#support/characters'

export type SiteMetadata = {
    title: string
    description: string
    tags: string[]
    iconUrl: string | null
}

export const MAX_TITLE_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 1000
export const MAX_TAGS = 10
const MAX_TAG_LENGTH = 40
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
            iconUrl: extracted.iconUrl,
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
            .filter(
                (keyword) =>
                    countChars(keyword) <= MAX_TAG_LENGTH &&
                    /^[\p{L}\p{N}][\p{L}\p{N}\s-]*$/u.test(keyword)
            )
            .slice(0, MAX_TAGS)
    }
}
