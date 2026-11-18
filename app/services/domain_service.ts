import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { errors as vineErrors } from '@vinejs/vine'
import { DateTime } from 'luxon'
import { RemoteFetchException, SiteRedirectedException } from '#exceptions/remote_fetch_exception'
import { dispatchDomainCrawl } from '#jobs/crawl_domain_dispatch'
import Domain from '#models/domain'
import Tag from '#models/tag'
import type User from '#models/user'
import SiteIconFinder from '#services/site_icon_finder'
import SiteMetadataFetcher, { type SiteMetadata } from '#services/site_metadata_fetcher'
import { addressOf, entryUrlOf, hostOf } from '#support/site_address'

const RECRAWL_AFTER_DAYS = 7
const RECRAWL_BATCH_SIZE = 100
const UNIQUE_VIOLATION = '23505'

type ReachableSite = { siteUrl: string; metadata: SiteMetadata }

// Setara Str::slug untuk nama tag: huruf beraksen menjadi huruf dasar, selain huruf/angka menjadi "-".
function slugOf(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: unknown } | null)?.code === UNIQUE_VIOLATION
}

@inject()
export default class DomainService {
    constructor(
        private readonly metadataFetcher: SiteMetadataFetcher,
        private readonly iconFinder: SiteIconFinder
    ) {}

    /**
     * Pemilik cukup mengisi link (boleh dengan path): judul, deskripsi, tag, dan logo diambil dari halaman itu,
     * lalu crawl pertama dijadwalkan dalam transaksi yang sama. Superadmin boleh mendaftarkan link atas nama
     * member lain lewat ownerId; created_by tetap pengguna yang menambahkan.
     */
    async create(actor: User, url: string, ownerId: number = actor.id): Promise<Domain> {
        const { siteUrl, metadata } = await this.fetchReachableSite(url)
        const logoUrl = await this.iconFinder.find(metadata.iconUrl, siteUrl)

        return db.transaction(async (trx) => {
            const domain = await Domain.create(
                {
                    userId: ownerId,
                    url: siteUrl,
                    host: hostOf(url),
                    title: metadata.title,
                    description: metadata.description,
                    logoUrl,
                    crawlStatus: 'pending',
                    createdBy: actor.id,
                    updatedBy: actor.id,
                },
                { client: trx }
            )

            await this.syncTags(domain, metadata.tags, trx)
            await dispatchDomainCrawl(domain.id, trx)

            return domain
        })
    }

    /**
     * Mengganti link: data situs diambil ulang, halaman lama dibuang bila link berubah,
     * dan crawl dijadwalkan ulang.
     */
    async update(domain: Domain, editor: User, url: string): Promise<Domain> {
        const { siteUrl, metadata } = await this.fetchReachableSite(url)
        const logoUrl = await this.iconFinder.find(metadata.iconUrl, siteUrl)
        // Link berbeda berarti cakupan crawl berbeda, jadi halaman lama tidak berlaku lagi.
        const isLinkChanged = addressOf(url) !== addressOf(domain.url)

        await db.transaction(async (trx) => {
            domain.useTransaction(trx)
            domain.merge({
                url: siteUrl,
                host: hostOf(url),
                title: metadata.title,
                description: metadata.description,
                logoUrl,
                crawlStatus: 'pending',
                lastCrawledAt: isLinkChanged ? null : domain.lastCrawledAt,
                updatedBy: editor.id,
            })
            await domain.save()

            if (isLinkChanged) {
                await domain.related('pages').query().delete()
            }

            await this.syncTags(domain, metadata.tags, trx)
            await dispatchDomainCrawl(domain.id, trx)
        })

        return domain
    }

    /**
     * Dipakai crawler agar judul, deskripsi, tag, dan logo mengikuti perubahan di situs pemilik.
     */
    async refreshMetadata(domain: Domain, metadata: SiteMetadata): Promise<void> {
        const logoUrl = await this.iconFinder.find(metadata.iconUrl, domain.url)

        await db.transaction(async (trx) => {
            domain.useTransaction(trx)
            domain.merge({ title: metadata.title, description: metadata.description, logoUrl })
            await domain.save()
            await this.syncTags(domain, metadata.tags, trx)
        })
    }

    async delete(domain: Domain, editor: User): Promise<void> {
        await db.transaction(async (trx) => {
            domain.useTransaction(trx)
            domain.merge({ updatedBy: editor.id, deletedAt: DateTime.now() })
            await domain.save()
        })
    }

    async requestCrawl(domain: Domain, editor: User): Promise<Domain> {
        if (domain.crawlStatus === 'pending' || domain.crawlStatus === 'crawling') {
            throw new vineErrors.E_VALIDATION_ERROR([
                {
                    field: 'crawl',
                    message:
                        'Pembaruan data untuk domain ini sedang berjalan. Tunggu hingga selesai.',
                },
            ])
        }

        await db.transaction(async (trx) => {
            domain.useTransaction(trx)
            domain.merge({ crawlStatus: 'pending', updatedBy: editor.id })
            await domain.save()
            await dispatchDomainCrawl(domain.id, trx)
        })

        return domain
    }

    /**
     * Pengganti jadwal mingguan domains:recrawl: menjadwalkan crawl ulang untuk domain yang datanya
     * sudah lebih dari seminggu. Dipanggil berkala oleh worker antrean. Mengembalikan jumlah domain yang dijadwalkan.
     */
    async scheduleDueRecrawls(): Promise<number> {
        const dueBefore = DateTime.now()
            .minus({ days: RECRAWL_AFTER_DAYS })
            .toSQL({ includeOffset: false })
        let scheduledCount = 0
        let lastId = 0

        while (true) {
            const domains = await Domain.query()
                .withScopes((scopes) => scopes.active())
                .whereNotIn('crawl_status', ['pending', 'crawling'])
                .where((query) =>
                    query.whereNull('last_crawled_at').orWhere('last_crawled_at', '<', dueBefore)
                )
                .where('id', '>', lastId)
                .orderBy('id')
                .limit(RECRAWL_BATCH_SIZE)

            if (domains.length === 0) {
                return scheduledCount
            }

            for (const domain of domains) {
                await db.transaction(async (trx) => {
                    domain.useTransaction(trx)
                    domain.crawlStatus = 'pending'
                    await domain.save()
                    await dispatchDomainCrawl(domain.id, trx)
                })
                scheduledCount++
                lastId = domain.id
            }
        }
    }

    /**
     * Membaca halaman yang didaftarkan. Alamat dicoba lewat https lebih dulu; bila situs
     * hanya melayani http, alamat http yang dipakai dan disimpan. Link pengalih yang tujuannya
     * menolak pembaca otomatis tetap diterima; crawl berikutnya menandainya "Dialihkan".
     */
    private async fetchReachableSite(url: string): Promise<ReachableSite> {
        const host = hostOf(url)
        const siteUrl = entryUrlOf(url)

        try {
            return { siteUrl, metadata: await this.metadataFetcher.fetch(siteUrl, host) }
        } catch (httpsFailure) {
            // Link sudah terbukti hidup karena mengalihkan; mencoba http tidak akan mengubah tujuannya.
            if (httpsFailure instanceof SiteRedirectedException) {
                return {
                    siteUrl,
                    metadata: this.metadataFetcher.forRedirectLink(siteUrl, httpsFailure.targetUrl),
                }
            }

            if (
                !(httpsFailure instanceof RemoteFetchException) ||
                !siteUrl.startsWith('https://')
            ) {
                throw httpsFailure
            }

            const httpUrl = `http://${siteUrl.slice('https://'.length)}`

            try {
                return {
                    siteUrl: httpUrl,
                    metadata: await this.metadataFetcher.fetch(httpUrl, host),
                }
            } catch (httpFailure) {
                if (httpFailure instanceof SiteRedirectedException) {
                    return {
                        siteUrl: httpUrl,
                        metadata: this.metadataFetcher.forRedirectLink(
                            httpUrl,
                            httpFailure.targetUrl
                        ),
                    }
                }

                if (!(httpFailure instanceof RemoteFetchException)) {
                    throw httpFailure
                }

                // Pesan kegagalan https lebih relevan bagi pemilik, karena itu alamat yang ia isi.
                throw httpsFailure
            }
        }
    }

    private async syncTags(
        domain: Domain,
        tagNames: string[],
        trx: TransactionClientContract
    ): Promise<void> {
        const tagIds: number[] = []
        const seenSlugs = new Set<string>()

        for (const rawName of tagNames) {
            const name = rawName.trim().toLowerCase()
            const slug = slugOf(name)

            if (slug === '' || seenSlugs.has(slug)) {
                continue
            }

            seenSlugs.add(slug)
            const tag = await this.findOrCreateTag(name, slug, trx)
            tagIds.push(tag.id)
        }

        await domain.related('tags').sync(tagIds, true, trx)
    }

    // Dua situs bisa membuat tag yang sama bersamaan; savepoint menjaga transaksi luar tetap hidup saat bentrok.
    private async findOrCreateTag(
        name: string,
        slug: string,
        trx: TransactionClientContract
    ): Promise<Tag> {
        const existing = await Tag.query({ client: trx }).where('slug', slug).first()

        if (existing !== null) {
            return existing
        }

        try {
            return await trx.transaction((savepoint) =>
                Tag.create({ name, slug }, { client: savepoint })
            )
        } catch (error) {
            if (!isUniqueViolation(error)) {
                throw error
            }

            return Tag.query({ client: trx }).where('slug', slug).firstOrFail()
        }
    }
}
