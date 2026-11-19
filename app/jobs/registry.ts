import CrawlDomainJob from '#jobs/CrawlDomainJob'
import type { QueueJobClass } from '#services/QueueWorker'

/**
 * Semua jenis pekerjaan yang dikenali worker. Pekerjaan baru wajib didaftarkan di sini.
 */
export const QUEUE_JOBS: QueueJobClass[] = [CrawlDomainJob]
