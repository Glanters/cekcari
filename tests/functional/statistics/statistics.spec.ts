import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { createSuperadmin, createUser, resetLimiters } from '#tests/functional/auth/authHelpers'
import { createDomain } from '#tests/functional/domains/domainHelpers'
import { panel, search } from '#tests/helpers'
import { visitorKeyOf } from '#services/VisitTracker'

async function insertClick(domainId: number, visitorId: string, clickedAt = DateTime.now()) {
    await db.table('domain_clicks').insert({
        domain_id: domainId,
        visitor_key: visitorKeyOf(visitorId),
        is_promoted: false,
        clicked_at: clickedAt.toJSDate(),
        created_at: clickedAt.toJSDate(),
        updated_at: clickedAt.toJSDate(),
    })
}

test.group('Pencatatan kunjungan dan klik', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => resetLimiters())

    test('menghitung satu pengunjung per hari beserta jumlah kunjungannya, tanpa token CSRF', async ({
        client,
        assert,
    }) => {
        const visitor = randomUUID()

        for (const visitorId of [visitor, visitor, randomUUID()]) {
            const response = await search(client)
                .post('/api/v1/visits')
                .json({ visitor_id: visitorId })
            response.assertStatus(200)
        }

        const rows = await db.from('site_visits').orderBy('views', 'desc')
        assert.lengthOf(rows, 2)
        assert.equal(rows[0].views, 2)
        assert.equal(rows[0].visitor_key, visitorKeyOf(visitor))
        assert.notInclude(JSON.stringify(rows), visitor)
    })

    test('menolak ID pengunjung yang bukan UUID', async ({ client }) => {
        const response = await search(client)
            .post('/api/v1/visits')
            .json({ visitor_id: 'bukan-uuid' })

        response.assertStatus(422)
    })

    test('mencatat klik situs sekali untuk klik beruntun dan menolak situs yang dihapus', async ({
        client,
        assert,
    }) => {
        const domain = await createDomain()
        const removed = await createDomain({ deletedAt: DateTime.now() })
        const visitorId = randomUUID()

        for (let click = 1; click <= 2; click++) {
            const response = await search(client)
                .post('/api/v1/domain-clicks')
                .json({ visitor_id: visitorId, domain_id: domain.id, is_promoted: true })
            response.assertStatus(200)
        }

        const removedResponse = await search(client)
            .post('/api/v1/domain-clicks')
            .json({ visitor_id: visitorId, domain_id: removed.id })
        removedResponse.assertStatus(404)

        const clicks = await db.from('domain_clicks')
        assert.lengthOf(clicks, 1)
        assert.equal(Number(clicks[0].domain_id), domain.id)
        // Klaim is_promoted dari browser diabaikan; yang dipakai status situs di database.
        assert.isFalse(clicks[0].is_promoted)
    })

    test('pencatat hanya ada di domain pencarian', async ({ client }) => {
        const response = await panel(client)
            .post('/api/v1/visits')
            .json({ visitor_id: randomUUID() })

        response.assertStatus(404)
    })
})

test.group('Statistik di panel', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => resetLimiters())

    test('superadmin melihat pengunjung dan klik semua situs, urut dari klik terbanyak', async ({
        client,
        assert,
    }) => {
        const admin = await createSuperadmin()
        const member = await createUser()
        const popular = await createDomain({}, member)
        const quiet = await createDomain({}, admin)
        const [first, second] = [randomUUID(), randomUUID()]

        await insertClick(popular.id, first)
        await insertClick(popular.id, second)
        await insertClick(popular.id, second, DateTime.now().minus({ minutes: 5 }))
        await insertClick(quiet.id, first)
        await search(client).post('/api/v1/visits').json({ visitor_id: first })
        await search(client).post('/api/v1/visits').json({ visitor_id: first })
        await search(client).post('/api/v1/visits').json({ visitor_id: second })

        const response = await panel(client).get('/api/v1/statistics?range=today').loginAs(admin)

        response.assertStatus(200)
        response.assertBodyContains({
            data: {
                range: 'today',
                can_view_all: true,
                visitors: { unique: 2, visits: 3 },
                clicks: { total: 4, unique: 2 },
            },
        })
        const items = response.body().data.items
        assert.deepEqual(
            items.map((item: { id: number; clicks: number; unique_clicks: number }) => [
                item.id,
                item.clicks,
                item.unique_clicks,
            ]),
            [
                [popular.id, 3, 2],
                [quiet.id, 1, 1],
            ]
        )
        assert.equal(items[0].owner.email, member.email)
    })

    test('member hanya melihat klik situs miliknya tanpa angka pengunjung', async ({
        client,
        assert,
    }) => {
        const member = await createUser()
        const own = await createDomain({}, member)
        const others = await createDomain()
        await insertClick(own.id, randomUUID())
        await insertClick(others.id, randomUUID())

        const response = await panel(client).get('/api/v1/statistics').loginAs(member)

        response.assertStatus(200)
        response.assertBodyContains({
            data: { can_view_all: false, visitors: null, clicks: { total: 1, unique: 1 } },
        })
        assert.deepEqual(
            response.body().data.items.map((item: { id: number }) => item.id),
            [own.id]
        )
    })

    test('rentang waktu memisahkan klik lama dari klik hari ini', async ({ client }) => {
        const admin = await createSuperadmin()
        const domain = await createDomain({}, admin)
        await insertClick(domain.id, randomUUID(), DateTime.now().minus({ days: 10 }))
        await insertClick(domain.id, randomUUID())

        const today = await panel(client).get('/api/v1/statistics?range=today').loginAs(admin)
        today.assertBodyContains({ data: { clicks: { total: 1 } } })

        const month = await panel(client).get('/api/v1/statistics?range=30d').loginAs(admin)
        month.assertBodyContains({ data: { clicks: { total: 2 } } })

        const invalid = await panel(client).get('/api/v1/statistics?range=setahun').loginAs(admin)
        invalid.assertStatus(422)
    })

    test('statistik hanya untuk akun yang sudah masuk', async ({ client }) => {
        const response = await panel(client).get('/api/v1/statistics')

        response.assertStatus(401)
    })
})
