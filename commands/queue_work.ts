import { setTimeout as sleep } from 'node:timers/promises'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

// Jeda saat antrean kosong sebelum memeriksa lagi.
const IDLE_SLEEP_MS = 3000
// Jeda setelah kesalahan tak terduga (mis. basis data putus) agar log tidak dibanjiri.
const ERROR_SLEEP_MS = 10_000
// Seberapa sering domain yang datanya sudah lebih dari seminggu dicari untuk di-crawl ulang.
const RECRAWL_CHECK_INTERVAL_MS = 60 * 60 * 1000

export default class QueueWork extends BaseCommand {
    static commandName = 'queue:work'
    static description =
        'Menjalankan pekerjaan antrean PostgreSQL dan menjadwalkan crawl ulang domain yang datanya sudah lama'

    static options: CommandOptions = {
        startApp: true,
        staysAlive: true,
    }

    async run() {
        const { default: QueueWorker } = await import('#services/queue_worker')
        const { QUEUE_JOBS } = await import('#jobs/registry')
        const { default: DomainService } = await import('#services/domain_service')

        const worker = new QueueWorker(QUEUE_JOBS)
        const domainService = await this.app.container.make(DomainService)
        let isStopping = false
        let lastRecrawlCheckAt = 0

        const scheduleRecrawlsWhenDue = async () => {
            if (Date.now() - lastRecrawlCheckAt < RECRAWL_CHECK_INTERVAL_MS) {
                return
            }

            lastRecrawlCheckAt = Date.now()
            const scheduledCount = await domainService.scheduleDueRecrawls()

            if (scheduledCount > 0) {
                this.logger.info(`${scheduledCount} domain dijadwalkan untuk crawl ulang.`)
            }
        }

        const loop = async () => {
            while (!isStopping) {
                try {
                    await scheduleRecrawlsWhenDue()
                    const hasProcessedJob = await worker.runNextJob()

                    if (!hasProcessedJob) {
                        await sleep(IDLE_SLEEP_MS)
                    }
                } catch (error) {
                    this.logger.error(
                        `Worker antrean gagal: ${error instanceof Error ? error.message : String(error)}`
                    )
                    await sleep(ERROR_SLEEP_MS)
                }
            }
        }

        const running = loop()

        // Pekerjaan yang sedang berjalan diselesaikan dulu sebelum koneksi basis data ditutup.
        this.app.terminating(async () => {
            isStopping = true
            await running
        })
        this.app.listenIf(!this.app.managedByPm2, 'SIGINT', () => this.app.terminate())
        this.logger.info('Worker antrean berjalan. Tekan Ctrl+C untuk berhenti.')
    }
}
