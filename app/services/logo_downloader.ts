import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { crawler } from '#config/cekcari'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'
import type FetchedPage from '#services/fetched_page'
import ObjectStorage from '#services/object_storage'
import RemotePageFetcher from '#services/remote_page_fetcher'
import { originOf } from '#support/site_address'

type ImageType = { extension: string; contentType: string; matches: (bytes: Buffer) => boolean }

const DIRECTORY = 'logos'

// SVG sengaja tidak diterima karena dapat memuat skrip.
const IMAGE_TYPES: ImageType[] = [
    {
        extension: 'ico',
        contentType: 'image/x-icon',
        matches: (bytes) => startsWith(bytes, [0x00, 0x00, 0x01, 0x00]),
    },
    {
        extension: 'png',
        contentType: 'image/png',
        matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    {
        extension: 'jpg',
        contentType: 'image/jpeg',
        matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
    },
    {
        extension: 'gif',
        contentType: 'image/gif',
        matches: (bytes) => ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('latin1')),
    },
    {
        extension: 'webp',
        contentType: 'image/webp',
        matches: (bytes) =>
            bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
            bytes.subarray(8, 12).toString('latin1') === 'WEBP',
    },
]

function startsWith(bytes: Buffer, signature: number[]): boolean {
    return (
        bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
    )
}

/**
 * Mengunduh ikon situs dan menyimpannya ke object storage sebagai logo domain.
 * Logo bersifat pelengkap: bila gagal, domain tetap tersimpan tanpa logo.
 */
@inject()
export default class LogoDownloader {
    constructor(
        private readonly fetcher: RemotePageFetcher,
        private readonly storage: ObjectStorage
    ) {}

    /**
     * Mengembalikan path logo di storage, atau null bila situs tidak punya ikon yang layak.
     */
    async download(iconUrl: string | null, siteUrl: string): Promise<string | null> {
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
                'Ikon situs tidak dapat diunduh'
            )

            return null
        }

        const imageType = this.detectImageType(icon)

        if (!icon.isSuccessful() || imageType === null) {
            return null
        }

        const path = `${DIRECTORY}/${randomUUID()}.${imageType.extension}`

        try {
            await this.storage.putPublic(path, icon.body, imageType.contentType)
        } catch (error) {
            logger.warn(
                { url: candidateUrl, err: error },
                'Logo situs gagal disimpan ke object storage'
            )

            return null
        }

        return path
    }

    async delete(path: string | null): Promise<void> {
        if (path === null) {
            return
        }

        try {
            await this.storage.delete(path)
        } catch (error) {
            // Logo lama yang tertinggal hanya memakan ruang storage; tidak perlu menggagalkan proses.
            logger.warn({ path, err: error }, 'Logo lama gagal dihapus dari object storage')
        }
    }

    // Jenis berkas dipastikan dari isi berkas, bukan dari header yang dikirim situs.
    private detectImageType(icon: FetchedPage): ImageType | null {
        if (icon.body.length === 0 || icon.body.length > crawler.maxLogoBytes) {
            return null
        }

        return IMAGE_TYPES.find((imageType) => imageType.matches(icon.body)) ?? null
    }
}
