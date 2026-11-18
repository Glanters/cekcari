import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import {
    deleteJob,
    failJob,
    releaseJob,
    reserveNextJob,
    touchJob,
    type JobPayload,
    type ReservedJob,
} from '#services/queue'

export interface QueueJob {
    handle(payload: JobPayload): Promise<void>
    // Dipanggil sekali saat pekerjaan dinyatakan gagal permanen (percobaan habis).
    failed?(payload: JobPayload, error: unknown): Promise<void>
}

export interface QueueJobClass {
    jobName: string
    maxAttempts: number
    // Jeda sebelum percobaan berikutnya bila masih ada sisa percobaan.
    retryDelaySeconds: number
    new (...args: any[]): QueueJob
}

// Worker memperbarui reserved_at sesering ini selama pekerjaan berjalan.
const HEARTBEAT_INTERVAL_MS = 60_000
// Reservasi tanpa heartbeat selama ini berarti worker-nya mati; pekerjaan boleh diambil worker lain.
export const STALE_RESERVATION_SECONDS = 300

function describeError(error: unknown): string {
    return error instanceof Error
        ? (error.stack ?? `${error.name}: ${error.message}`)
        : String(error)
}

export default class QueueWorker {
    constructor(private readonly jobs: QueueJobClass[]) {}

    /**
     * Menjalankan satu pekerjaan. Mengembalikan false bila antrean sedang kosong.
     */
    async runNextJob(): Promise<boolean> {
        const reserved = await reserveNextJob(STALE_RESERVATION_SECONDS)

        if (reserved === null) {
            return false
        }

        const jobClass = this.jobs.find((candidate) => candidate.jobName === reserved.name)

        if (jobClass === undefined) {
            logger.error(
                { jobId: reserved.id, jobName: reserved.name },
                'Jenis pekerjaan antrean tidak dikenal'
            )
            await failJob(
                reserved.id,
                `Jenis pekerjaan "${reserved.name}" tidak dikenal oleh worker.`
            )

            return true
        }

        const job = await app.container.make(jobClass)

        // Percobaan sebelumnya terputus (worker mati di tengah jalan) dan jatahnya sudah habis.
        if (reserved.attempts > jobClass.maxAttempts) {
            await this.giveUp(
                job,
                reserved,
                new Error(
                    'Pekerjaan terputus karena worker berhenti dan batas percobaan sudah habis.'
                )
            )

            return true
        }

        const heartbeat = setInterval(() => {
            touchJob(reserved.id).catch((error) =>
                logger.error(
                    { err: error, jobId: reserved.id },
                    'Heartbeat pekerjaan antrean gagal'
                )
            )
        }, HEARTBEAT_INTERVAL_MS)

        try {
            await job.handle(reserved.payload)
        } catch (error) {
            await this.handleFailure(jobClass, job, reserved, error)

            return true
        } finally {
            clearInterval(heartbeat)
        }

        await deleteJob(reserved.id)

        return true
    }

    private async handleFailure(
        jobClass: QueueJobClass,
        job: QueueJob,
        reserved: ReservedJob,
        error: unknown
    ): Promise<void> {
        logger.error(
            { err: error, jobId: reserved.id, jobName: reserved.name, attempt: reserved.attempts },
            'Pekerjaan antrean gagal'
        )

        if (reserved.attempts < jobClass.maxAttempts) {
            await releaseJob(reserved.id, describeError(error), jobClass.retryDelaySeconds)

            return
        }

        await this.giveUp(job, reserved, error)
    }

    private async giveUp(job: QueueJob, reserved: ReservedJob, error: unknown): Promise<void> {
        await failJob(reserved.id, describeError(error))

        try {
            await job.failed?.(reserved.payload, error)
        } catch (hookError) {
            logger.error(
                { err: hookError, jobId: reserved.id, jobName: reserved.name },
                'Penanganan kegagalan pekerjaan antrean ikut gagal'
            )
        }
    }
}
