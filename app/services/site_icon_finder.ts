import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { crawler } from '#config/cekcari'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'
import type FetchedPage from '#services/fetched_page'
import RemotePageFetcher from '#services/remote_page_fetcher'
import { originOf } from '#support/site_address'

type ImageSignature = (bytes: Buffer) => boolean

/**
 * Logo hanya ditampilkan lewat <img> langsung dari situs pemiliknya, sehingga skrip di dalam SVG
 * tidak pernah dijalankan browser; karena itu SVG ikut diterima di sini.
 */
const IMAGE_SIGNATURES: ImageSignature[] = [
    (bytes) => startsWith(bytes, [0x00, 0x00, 0x01, 0x00]),
    (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
    (bytes) => ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('latin1')),
    (bytes) =>
        bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
        bytes.subarray(8, 12).toString('latin1') === 'WEBP',
    (bytes) =>
        /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(
            bytes.subarray(0, 1024).toString('utf8')
        ),
]

function startsWith(bytes: Buffer, signature: number[]): boolean {
    return (
        bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
    )
}

/**
 * Mencari ikon situs dan mengembalikan alamatnya. Logo tidak disimpan di server: halaman CekCari
 * menampilkannya langsung dari domain pemilik situs. Ikon diperiksa dulu agar alamat yang disimpan
 * benar-benar gambar, bukan halaman error. Bila tidak ada ikon yang layak, domain tetap tersimpan tanpa logo.
 */
@inject()
export default class SiteIconFinder {
    constructor(private readonly fetcher: RemotePageFetcher) {}

    async find(iconUrl: string | null, siteUrl: string): Promise<string | null> {
        const candidateUrl = iconUrl ?? `${originOf(siteUrl)}/favicon.ico`
        let icon: FetchedPage

        try {
            icon = await this.fetcher.fetch(candidateUrl)
        } catch (error) {
            if (!(error instanceof RemoteFetchException)) {
                throw error
            }

            logger.info(
                { url: candidateUrl, reason: error.message },
                'Ikon situs tidak dapat dibuka'
            )

            return null
        }

        return icon.isSuccessful() && this.isImage(icon) ? icon.url : null
    }

    // Jenis berkas dipastikan dari isi berkas, bukan dari header yang dikirim situs.
    private isImage(icon: FetchedPage): boolean {
        if (icon.body.length === 0 || icon.body.length > crawler.maxLogoBytes) {
            return false
        }

        return IMAGE_SIGNATURES.some((matches) => matches(icon.body))
    }
}
