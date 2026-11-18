import CrawlDomainJob from '#jobs/crawl_domain_job'
import type { QueueJobClass } from '#services/queue_worker'

/**
 * Semua jenis pekerjaan yang dikenali worker. Pekerjaan baru wajib didaftarkan di sini.
 */
export const QUEUE_JOBS: QueueJobClass[] = [CrawlDomainJob]
