import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { dispatchDomainCrawl } from '#jobs/crawl_domain_dispatch'
import { QUEUE_JOBS } from '#jobs/registry'
import DomainService from '#services/domain_service'
import { dispatch, type JobPayload } from '#services/queue'
import QueueWorker, { STALE_RESERVATION_SECONDS, type QueueJob } from '#services/queue_worker'
import { createDomain, queuedCrawlDomainIds } from '#tests/functional/domains/domain_helpers'
import {
    fakeDns,
    fakeRemoteSites,
    htmlPage,
    restoreRemoteFakes,
} from '#tests/fakes/remote_sites'

const handledPayloads: JobPayload[] = []
const failedPayloads: JobPayload[] = []

class RecordingJob implements QueueJob {
    static jobName = 'test-recording'
    static maxAttempts = 2
    static retryDelaySeconds = 0

    async handle(payload: JobPayload) {
        if (payload.shouldFail) {
            throw new Error('Gagal disengaja')
        }

        handledPayloads.push(payload)
    }

    async failed(payload: JobPayload) {
        failedPayloads.push(payload)
    }
}

async function jobRows() {
    return db.from('queue_jobs').orderBy('id').select('*')
}

test.group('Antrean PostgreSQL', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        handledPayloads.length = 0
        failedPayloads.length = 0
        fakeDns()

        return () => restoreRemoteFakes()
    })

    test('pekerjaan dengan kunci yang sama tidak dicatat dua kali selama belum selesai', async ({
        assert,
    }) => {
        assert.isTrue(await dispatch('test-recording', { nomor: 1 }, { uniqueKey: 'kunci' }))
        assert.isFalse(await dispatch('test-recording', { nomor: 2 }, { uniqueKey: 'kunci' }))
        assert.isTrue(await dispatch('test-recording', { nomor: 3 }))
        assert.isTrue(await dispatch('test-recording', { nomor: 4 }))

        assert.lengthOf(await jobRows(), 3)
    })

    test('pekerjaan ikut batal bila transaksi luarnya gagal', async ({ assert }) => {
        const domain = await createDomain()

        await assert.rejects(() =>
            db.transaction(async (trx) => {
                await dispatchDomainCrawl(domain.id, trx)
                throw new Error('Transaksi dibatalkan')
            })
        )

        assert.deepEqual(await queuedCrawlDomainIds(), [])
    })

    test('worker menjalankan pekerjaan lalu menghapusnya', async ({ assert }) => {
        await dispatch('test-recording', { nomor: 1 })
        const worker = new QueueWorker([RecordingJob])

        assert.isTrue(await worker.runNextJob())
        assert.isFalse(await worker.runNextJob())
        assert.deepEqual(handledPayloads, [{ nomor: 1 }])
        assert.lengthOf(await jobRows(), 0)
    })

    test('pekerjaan yang gagal dicoba ulang lalu dicatat gagal setelah percobaan habis', async ({
        assert,
    }) => {
        await dispatch('test-recording', { shouldFail: true }, { uniqueKey: 'gagal' })
        const worker = new QueueWorker([RecordingJob])

        await worker.runNextJob()
        let [row] = await jobRows()
        assert.isNull(row.failed_at)
        assert.isNull(row.reserved_at)
        assert.include(row.last_error, 'Gagal disengaja')

        await worker.runNextJob()
        ;[row] = await jobRows()
        assert.isNotNull(row.failed_at)
        assert.equal(row.attempts, 2)
        assert.deepEqual(failedPayloads, [{ shouldFail: true }])

        // Baris yang gagal tidak lagi menghalangi pekerjaan baru dengan kunci yang sama.
        assert.isTrue(
            await dispatch('test-recording', { shouldFail: true }, { uniqueKey: 'gagal' })
        )
    })

    test('pekerjaan dengan nama yang tidak dikenal dicatat gagal', async ({ assert }) => {
        await dispatch('tidak-dikenal', {})

        await new QueueWorker([RecordingJob]).runNextJob()

        const [row] = await jobRows()
        assert.isNotNull(row.failed_at)
        assert.include(row.last_error, 'tidak-dikenal')
    })

    test('reservasi milik worker yang mati diambil ulang setelah batas waktu', async ({
        assert,
    }) => {
        await dispatch('test-recording', { nomor: 1 })
        await db.rawQuery(
            `UPDATE queue_jobs SET reserved_at = now() - make_interval(secs => ?), attempts = 1`,
            [STALE_RESERVATION_SECONDS + 1]
        )

        await new QueueWorker([RecordingJob]).runNextJob()

        assert.deepEqual(handledPayloads, [{ nomor: 1 }])
        assert.lengthOf(await jobRows(), 0)
    })

    test('reservasi yang masih aktif tidak diambil worker lain', async ({ assert }) => {
        await dispatch('test-recording', { nomor: 1 })
        await db.rawQuery('UPDATE queue_jobs SET reserved_at = now(), attempts = 1')

        assert.isFalse(await new QueueWorker([RecordingJob]).runNextJob())
    })

    test('crawl yang terputus dan kehabisan percobaan menandai domain gagal', async ({
        assert,
    }) => {
        const domain = await createDomain({ crawlStatus: 'crawling' })
        await dispatchDomainCrawl(domain.id)
        await db.rawQuery(
            `UPDATE queue_jobs SET reserved_at = now() - make_interval(secs => ?), attempts = 1`,
            [STALE_RESERVATION_SECONDS + 1]
        )

        await new QueueWorker(QUEUE_JOBS).runNextJob()

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'failed')
        const [row] = await jobRows()
        assert.isNotNull(row.failed_at)
    })

    test('worker menjalankan crawl domain dari antrean', async ({ assert }) => {
        const domain = await createDomain({
            url: 'https://tokoku.com',
            host: 'tokoku.com',
            crawlStatus: 'pending',
        })
        fakeRemoteSites({
            'tokoku.com/robots.txt': { status: 404 },
            'tokoku.com/*': htmlPage('<title>Tokoku</title><body>Halo</body>'),
        })
        await dispatchDomainCrawl(domain.id)

        await new QueueWorker(QUEUE_JOBS).runNextJob()

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'done')
        assert.lengthOf(await jobRows(), 0)
    })

    test('menjadwalkan crawl ulang untuk domain yang datanya lebih dari seminggu', async ({
        assert,
    }) => {
        const stale = await createDomain({
            crawlStatus: 'done',
            lastCrawledAt: DateTime.now().minus({ days: 8 }),
        })
        const neverCrawled = await createDomain({ crawlStatus: 'failed', lastCrawledAt: null })
        await createDomain({
            crawlStatus: 'done',
            lastCrawledAt: DateTime.now().minus({ days: 2 }),
        })
        await createDomain({ crawlStatus: 'pending', lastCrawledAt: null })
        await createDomain({
            crawlStatus: 'done',
            lastCrawledAt: DateTime.now().minus({ days: 30 }),
            deletedAt: DateTime.now(),
        })
        const domainService = await app.container.make(DomainService)

        assert.equal(await domainService.scheduleDueRecrawls(), 2)

        assert.sameMembers(await queuedCrawlDomainIds(), [stale.id, neverCrawled.id])
        await stale.refresh()
        assert.equal(stale.crawlStatus, 'pending')
        assert.equal(await domainService.scheduleDueRecrawls(), 0)
    })
})
