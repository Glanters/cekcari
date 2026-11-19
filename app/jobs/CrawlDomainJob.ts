import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { RemoteFetchException, SiteRedirectedException } from '#exceptions/RemoteFetchException'
import { CRAWL_DOMAIN_JOB } from '#jobs/crawlDomainDispatch'
import Domain from '#models/domain'
import DomainCrawler from '#services/DomainCrawler'
import DomainService from '#services/DomainService'
import type { JobPayload } from '#services/queue'
import type { QueueJob } from '#services/QueueWorker'
import SiteMetadataFetcher from '#services/SiteMetadataFetcher'

const MAX_REDIRECTED_TO_LENGTH = 2048

function domainIdOf(payload: JobPayload): number {
    const domainId = Number(payload.domainId)

    if (!Number.isInteger(domainId) || domainId <= 0) {
        throw new Error(`Payload crawl domain tidak valid: ${JSON.stringify(payload)}`)
    }

    return domainId
}

/**
 * Dijalankan lewat antrean PostgreSQL, bukan Redis, karena pekerjaan ini mengubah data
 * dan dicatat ke antrean dalam transaksi yang sama dengan perubahan status domain.
 */
@inject()
export default class CrawlDomainJob implements QueueJob {
    static jobName = CRAWL_DOMAIN_JOB
    static maxAttempts = 1
    static retryDelaySeconds = 60

    constructor(
        private readonly crawler: DomainCrawler,
        private readonly metadataFetcher: SiteMetadataFetcher,
        private readonly domainService: DomainService
    ) {}

    async handle(payload: JobPayload): Promise<void> {
        const domain = await Domain.query()
            .withScopes((scopes) => scopes.active())
            .where('id', domainIdOf(payload))
            .first()

        if (domain === null) {
            return
        }

        domain.crawlStatus = 'crawling'
        await domain.save()

        try {
            await this.domainService.refreshMetadata(
                domain,
                await this.metadataFetcher.fetch(domain.url, domain.host)
            )
            await this.crawler.crawl(domain)
        } catch (error) {
            if (error instanceof SiteRedirectedException) {
                logger.info(
                    { domainId: domain.id, target: error.targetUrl },
                    'Link domain mengalihkan ke domain lain'
                )
                domain.merge({
                    crawlStatus: 'redirected',
                    redirectedTo: error.targetUrl.slice(0, MAX_REDIRECTED_TO_LENGTH),
                    lastCrawledAt: DateTime.now(),
                })
                await domain.save()

                return
            }

            if (error instanceof RemoteFetchException) {
                logger.warn({ domainId: domain.id, reason: error.message }, 'Crawl domain gagal')
                domain.merge({
                    crawlStatus: 'failed',
                    redirectedTo: null,
                    lastCrawledAt: DateTime.now(),
                })
                await domain.save()

                return
            }

            throw error
        }

        domain.merge({ crawlStatus: 'done', redirectedTo: null, lastCrawledAt: DateTime.now() })
        await domain.save()
    }

    // Kesalahan tak terduga (bukan kegagalan situs) tidak boleh membuat domain terjebak di status "crawling".
    async failed(payload: JobPayload): Promise<void> {
        await Domain.query().where('id', domainIdOf(payload)).update({ crawl_status: 'failed' })
    }
}
