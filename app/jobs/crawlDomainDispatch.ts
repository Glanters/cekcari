import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { dispatch } from '#services/queue'

/**
 * Dipisah dari CrawlDomainJob.ts supaya DomainService bisa menjadwalkan crawl tanpa impor melingkar
 * (job tersebut memakai DomainService).
 */
export const CRAWL_DOMAIN_JOB = 'crawl-domain'

export type CrawlDomainPayload = { domainId: number }

/**
 * Satu domain hanya punya satu crawl yang menunggu/berjalan; permintaan berikutnya selama itu diabaikan.
 */
export function dispatchDomainCrawl(
    domainId: number,
    client?: QueryClientContract
): Promise<boolean> {
    const payload: CrawlDomainPayload = { domainId }

    return dispatch(CRAWL_DOMAIN_JOB, payload, {
        uniqueKey: `${CRAWL_DOMAIN_JOB}:${domainId}`,
        client,
    })
}
