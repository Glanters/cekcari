import { test } from '@japa/runner'
import { panel } from '#tests/helpers'
import testUtils from '@adonisjs/core/services/test_utils'
import Domain from '#models/domain'
import { createSuperadmin, createUser } from '#tests/functional/auth/authHelpers'
import {
    createDomain,
    queuedCrawlDomainIds,
} from '#tests/functional/domains/domainHelpers'
import {
    fakeDns,
    fakeRemoteSites,
    htmlPage,
    restoreRemoteFakes,
} from '#tests/fakes/remoteSites'

test.group('Panel domain: superadmin mengelola situs semua member', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        fakeDns()

        return () => restoreRemoteFakes()
    })

    test('superadmin melihat situs semua member, atau miliknya sendiri dengan owner=mine', async ({
        client,
        assert,
    }) => {
        const superadmin = await createSuperadmin()
        const member = await createUser()
        const own = await createDomain({}, superadmin)
        const membersDomain = await createDomain({}, member)

        const all = await panel(client).get('/api/v1/domains').loginAs(superadmin)
        all.assertStatus(200)
        const allIds = all.body().data.items.map((item: { id: number }) => item.id)
        assert.includeMembers(allIds, [own.id, membersDomain.id])
        const memberItem = all
            .body()
            .data.items.find((item: { id: number }) => item.id === membersDomain.id)
        assert.deepEqual(memberItem.owner, {
            id: member.id,
            name: member.name,
            email: member.email,
        })
        assert.isTrue(memberItem.can_manage)

        const mine = await panel(client).get('/api/v1/domains?owner=mine').loginAs(superadmin)
        mine.assertStatus(200)
        assert.deepEqual(
            mine.body().data.items.map((item: { id: number }) => item.id),
            [own.id]
        )

        const filtered = await panel(client)
            .get(`/api/v1/domains?user_id=${member.id}`)
            .loginAs(superadmin)
        assert.deepEqual(
            filtered.body().data.items.map((item: { id: number }) => item.id),
            [membersDomain.id]
        )
    })

    test('member hanya melihat situsnya sendiri walau meminta owner=all atau user_id lain', async ({
        client,
        assert,
    }) => {
        const member = await createUser()
        const other = await createUser()
        const own = await createDomain({}, member)
        await createDomain({}, other)

        const response = await panel(client)
            .get(`/api/v1/domains?owner=all&user_id=${other.id}`)
            .loginAs(member)

        response.assertStatus(200)
        assert.deepEqual(
            response.body().data.items.map((item: { id: number }) => item.id),
            [own.id]
        )
        assert.isTrue(response.body().data.items[0].can_manage)
    })

    test('superadmin melihat detail situs member, member lain tidak', async ({ client }) => {
        const domain = await createDomain()

        const bySuperadmin = await panel(client)
            .get(`/api/v1/domains/${domain.id}`)
            .loginAs(await createSuperadmin())
        bySuperadmin.assertStatus(200)
        bySuperadmin.assertBodyContains({
            data: { id: domain.id, owner: { id: domain.userId }, can_manage: true },
        })

        const byMember = await panel(client)
            .get(`/api/v1/domains/${domain.id}`)
            .loginAs(await createUser())
        byMember.assertStatus(403)
    })

    test('superadmin menambahkan situs atas nama member', async ({ client, assert }) => {
        fakeRemoteSites({
            'https://psms.com/*': htmlPage('<title>PSMS Medan</title><body>Ayam Kinantan</body>'),
        })
        const superadmin = await createSuperadmin()
        const member = await createUser()

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'psms.com', user_id: member.id })
            .withCsrfToken()
            .loginAs(superadmin)

        response.assertStatus(201)
        response.assertBodyContains({ data: { owner: { id: member.id }, can_manage: true } })
        const domain = await Domain.findOrFail(response.body().data.id)
        assert.equal(domain.userId, member.id)
        assert.equal(domain.createdBy, superadmin.id)
        assert.equal(domain.updatedBy, superadmin.id)
        assert.deepEqual(await queuedCrawlDomainIds(), [domain.id])
    })

    test('pesan link ganda mengikuti pemilik tujuan saat superadmin menambahkan', async ({
        client,
    }) => {
        fakeRemoteSites()
        const superadmin = await createSuperadmin()
        const member = await createUser()
        await createDomain({ host: 'psms.id', url: 'https://psms.id' }, member)

        const forMember = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'psms.id', user_id: member.id })
            .withCsrfToken()
            .loginAs(superadmin)
        forMember.assertStatus(422)
        forMember.assertBodyContains({ errors: { url: ['Link ini sudah ada di daftar Anda.'] } })

        const forSelf = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'psms.id' })
            .withCsrfToken()
            .loginAs(superadmin)
        forSelf.assertStatus(422)
        forSelf.assertBodyContains({
            errors: { url: ['Link ini sudah didaftarkan oleh akun lain.'] },
        })
    })

    test('member tidak boleh menambahkan situs atas nama akun lain', async ({ client, assert }) => {
        const sites = fakeRemoteSites()
        const other = await createUser()

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://psms.com', user_id: other.id })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(403)
        assert.deepEqual(sites.sentUrls, [])
    })

    test('pemilik yang tidak ada atau belum aktif ditolak: {$self}')
        .with(['belum aktif', 'tidak ada'])
        .run(async ({ client, assert }, scenario) => {
            const sites = fakeRemoteSites()
            const inactiveUser = await createUser({ activatedAt: null })
            const ownerId = scenario === 'belum aktif' ? inactiveUser.id : 999999999

            const response = await panel(client)
                .post('/api/v1/domains')
                .json({ url: 'https://psms.com', user_id: ownerId })
                .withCsrfToken()
                .loginAs(await createSuperadmin())

            response.assertStatus(422)
            response.assertBodyContains({
                errors: { user_id: ['Pemilik tidak ditemukan atau belum aktif.'] },
            })
            assert.deepEqual(sites.sentUrls, [])
        })

    test('superadmin mengubah, mempromosikan, memperbarui, dan menghapus situs member', async ({
        client,
        assert,
    }) => {
        fakeRemoteSites({ 'tokoku.com/*': htmlPage('<title>Tokoku</title><body>Halo</body>') })
        const superadmin = await createSuperadmin()
        const domain = await createDomain()
        const ownerId = domain.userId

        const update = await panel(client)
            .put(`/api/v1/domains/${domain.id}`)
            .json({ url: 'https://tokoku.com' })
            .withCsrfToken()
            .loginAs(superadmin)
        update.assertStatus(200)
        update.assertBodyContains({
            data: { url: 'https://tokoku.com', owner: { id: domain.userId } },
        })

        const promote = await panel(client)
            .put(`/api/v1/domains/${domain.id}/promotion`)
            .json({ is_promoted: true })
            .withCsrfToken()
            .loginAs(superadmin)
        promote.assertStatus(200)

        await Domain.query().where('id', domain.id).update({ crawl_status: 'done' })
        const crawl = await panel(client)
            .post(`/api/v1/domains/${domain.id}/crawls`)
            .withCsrfToken()
            .loginAs(superadmin)
        crawl.assertStatus(201)

        const destroy = await panel(client)
            .delete(`/api/v1/domains/${domain.id}`)
            .withCsrfToken()
            .loginAs(superadmin)
        destroy.assertStatus(200)

        await domain.refresh()
        assert.equal(domain.userId, ownerId)
        assert.equal(domain.updatedBy, superadmin.id)
        assert.isNotNull(domain.deletedAt)
    })

    test('daftar calon pemilik hanya untuk superadmin', async ({ client, assert }) => {
        const superadmin = await createSuperadmin()
        const member = await createUser({ name: 'Budi 100%_Asli' })
        await createUser({ name: 'Budi Belum Aktif', activatedAt: null })

        const response = await panel(client)
            .get('/api/v1/domain-owners?q=100%25_')
            .loginAs(superadmin)
        response.assertStatus(200)
        assert.deepEqual(response.body().data.items, [
            { id: member.id, name: member.name, email: member.email },
        ])

        const inactiveSearch = await panel(client)
            .get('/api/v1/domain-owners?q=Belum')
            .loginAs(superadmin)
        assert.lengthOf(inactiveSearch.body().data.items, 0)

        const byMember = await panel(client).get('/api/v1/domain-owners').loginAs(member)
        byMember.assertStatus(403)
    })
})
