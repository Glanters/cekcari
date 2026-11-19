import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import CrawlDomainJob from '#jobs/CrawlDomainJob'
import type Domain from '#models/domain'
import { panel } from '#tests/helpers'
import { createSuperadmin, createUser } from '#tests/functional/auth/authHelpers'
import { createDomain } from '#tests/functional/domains/domainHelpers'
import { fakeDns, fakeRemoteSites, htmlPage, restoreRemoteFakes } from '#tests/fakes/remoteSites'

async function tagNamesOf(domain: Domain): Promise<string[]> {
    await domain.load('tags', (query) => query.orderBy('domain_tag.id'))

    return domain.tags.map((tag) => tag.name)
}

test.group('Panel domain: mengubah deskripsi dan tag', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        fakeDns()

        return () => restoreRemoteFakes()
    })

    test('pemilik mengubah deskripsi dan tag link miliknya', async ({ client, assert }) => {
        const owner = await createUser()
        const domain = await createDomain({}, owner)

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({
                description: '  Situs resmi dengan layanan 24 jam.  ',
                tags: ['Togel Online', 'slot', 'togel online'],
            })
            .withCsrfToken()
            .loginAs(owner)

        response.assertStatus(200)
        response.assertBodyContains({
            success: true,
            message: 'Deskripsi dan tag disimpan',
            data: {
                description: 'Situs resmi dengan layanan 24 jam.',
                tags: ['togel online', 'slot'],
                is_description_edited: true,
                is_tags_edited: true,
            },
        })

        await domain.refresh()
        assert.equal(domain.updatedBy, owner.id)
    })

    test('hanya bagian yang berubah yang ditandai sebagai isian pemilik', async ({ client }) => {
        const owner = await createUser()
        const domain = await createDomain({ description: 'Lama.' }, owner)

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({ description: 'Baru.', tags: [] })
            .withCsrfToken()
            .loginAs(owner)

        response.assertBodyContains({
            data: { description: 'Baru.', is_description_edited: true, is_tags_edited: false },
        })
    })

    test('superadmin boleh mengubah link member, member lain tidak', async ({ client }) => {
        const domain = await createDomain()
        const payload = { description: 'Diubah.', tags: ['resmi'] }

        const stranger = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json(payload)
            .withCsrfToken()
            .loginAs(await createUser())
        stranger.assertStatus(403)

        const superadmin = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json(payload)
            .withCsrfToken()
            .loginAs(await createSuperadmin())
        superadmin.assertStatus(200)
        superadmin.assertBodyContains({ data: { description: 'Diubah.', tags: ['resmi'] } })
    })

    test('menolak tag yang tidak rapi dan terlalu banyak tag', async ({ client, assert }) => {
        const owner = await createUser()
        const domain = await createDomain({}, owner)

        const badTag = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({ description: 'Ok.', tags: ['<script>'] })
            .withCsrfToken()
            .loginAs(owner)
        badTag.assertStatus(422)
        badTag.assertBodyContains({
            errors: { 'tags.0': ['Tag hanya boleh berisi huruf, angka, spasi, dan tanda hubung.'] },
        })

        const tooMany = await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({
                description: 'Ok.',
                tags: Array.from({ length: 11 }, (_, index) => `tag ${index}`),
            })
            .withCsrfToken()
            .loginAs(owner)
        tooMany.assertStatus(422)
        tooMany.assertBodyContains({ errors: { tags: ['Paling banyak 10 tag.'] } })

        await domain.refresh()
        assert.equal(domain.description, 'Deskripsi situs.')
    })

    test('crawl ulang tidak menimpa deskripsi dan tag isian pemilik', async ({
        client,
        assert,
    }) => {
        const owner = await createUser()
        const domain = await createDomain(
            { url: 'https://tokoku.test', host: 'tokoku.test' },
            owner
        )
        await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({ description: 'Deskripsi pilihan pemilik.', tags: ['pilihan'] })
            .withCsrfToken()
            .loginAs(owner)
        fakeRemoteSites({
            'https://tokoku.test/robots.txt': { status: 404 },
            'https://tokoku.test/favicon.ico': { status: 404 },
            'https://tokoku.test/*': htmlPage(
                '<title>Tokoku Baru</title><meta name="description" content="Dari situs.">' +
                    '<meta name="keywords" content="otomatis"><body>Isi</body>'
            ),
        })

        const job = await app.container.make(CrawlDomainJob)
        await job.handle({ domainId: domain.id })

        await domain.refresh()
        assert.equal(domain.title, 'Tokoku Baru')
        assert.equal(domain.description, 'Deskripsi pilihan pemilik.')
        assert.deepEqual(await tagNamesOf(domain), ['pilihan'])
    })

    test('crawl ulang tetap memperbarui tag otomatis bila pemilik hanya mengubah deskripsi', async ({
        client,
        assert,
    }) => {
        const owner = await createUser()
        const domain = await createDomain(
            { url: 'https://tokoku.test', host: 'tokoku.test' },
            owner
        )
        await panel(client)
            .put(`/api/v1/domains/${domain.id}/details`)
            .json({ description: 'Deskripsi pilihan pemilik.', tags: [] })
            .withCsrfToken()
            .loginAs(owner)
        fakeRemoteSites({
            'https://tokoku.test/robots.txt': { status: 404 },
            'https://tokoku.test/favicon.ico': { status: 404 },
            'https://tokoku.test/*': htmlPage(
                '<title>Tokoku</title><meta name="keywords" content="otomatis"><body>Isi</body>'
            ),
        })

        const job = await app.container.make(CrawlDomainJob)
        await job.handle({ domainId: domain.id })

        await domain.refresh()
        assert.equal(domain.description, 'Deskripsi pilihan pemilik.')
        assert.deepEqual(await tagNamesOf(domain), ['otomatis'])
    })
})
