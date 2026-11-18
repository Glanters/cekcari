import { test } from '@japa/runner'
import { panel } from '#tests/helpers'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Domain from '#models/domain'
import Page from '#models/page'
import { createUser } from '#tests/functional/auth/auth_helpers'
import {
    createDomain,
    queuedCrawlDomainIds,
} from '#tests/functional/domains/domain_helpers'
import {
    PNG_BYTES,
    fakeDns,
    fakeObjectStorage,
    fakeRemoteSites,
    htmlPage,
    restoreRemoteFakes,
    type FakeObjectStorage,
    type FakeResponse,
} from '#tests/fakes/remote_sites'

const TOKOKU_SITE: Record<string, FakeResponse> = {
    'tokoku.com/logo.png': { status: 200, body: PNG_BYTES, contentType: 'image/png' },
    'tokoku.com/*': htmlPage(
        '<html><head><title>Tokoku Resmi</title>' +
            '<meta name="description" content="Toko perabot rumah tangga lengkap.">' +
            '<meta name="keywords" content="Dapur, rumah tangga, <script>">' +
            '<link rel="icon" href="/logo.png"></head><body>Selamat datang</body></html>'
    ),
}

test.group('Panel domain: menambah dan mengubah link', (group) => {
    let storage: FakeObjectStorage

    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        fakeDns()
        storage = fakeObjectStorage()

        return () => restoreRemoteFakes()
    })

    test('menambahkan domain hanya dari link dan mengambil datanya otomatis', async ({
        client,
        assert,
    }) => {
        fakeRemoteSites(TOKOKU_SITE)
        const user = await createUser()

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://Tokoku.com/' })
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(201)
        response.assertBodyContains({
            success: true,
            data: {
                url: 'https://tokoku.com',
                host: 'tokoku.com',
                title: 'Tokoku Resmi',
                description: 'Toko perabot rumah tangga lengkap.',
                tags: ['dapur', 'rumah tangga'],
                crawl_status: 'pending',
                pages_count: 0,
                owner: { id: user.id },
                can_manage: true,
            },
        })

        const domain = await Domain.firstOrFail()
        assert.equal(domain.createdBy, user.id)
        assert.match(domain.logoPath ?? '', /^logos\/[0-9a-f-]{36}\.png$/)
        assert.isTrue(storage.files.has(domain.logoPath as string))
        assert.deepEqual(await queuedCrawlDomainIds(), [domain.id])
    })

    test('menerima alamat polos tanpa http dan memakai https', async ({ client }) => {
        fakeRemoteSites({
            'https://psms.com/*': htmlPage('<title>PSMS Medan</title><body>Ayam Kinantan</body>'),
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: '  PSMS.com  ' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({ data: { url: 'https://psms.com', title: 'PSMS Medan' } })
    })

    test('beralih ke http bila situs tidak bisa dibuka lewat https', async ({ client }) => {
        fakeRemoteSites({
            'https://httponly.id/*': 'failed-connection',
            'http://httponly.id/*': htmlPage('<title>Hanya HTTP</title><body>Halo</body>'),
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'httponly.id' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({ data: { url: 'http://httponly.id', title: 'Hanya HTTP' } })
    })

    test('menyimpan link lengkap beserta path dan membaca data dari halaman itu', async ({
        client,
        assert,
    }) => {
        const sites = fakeRemoteSites({
            'https://psms.id/players': htmlPage(
                '<html><head><title>Pemain PSMS Medan</title><meta name="description" content="Daftar pemain musim ini."></head><body>Skuad</body></html>'
            ),
            'https://psms.id/favicon.ico': { status: 404 },
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'psms.id/players/' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({
            data: {
                url: 'https://psms.id/players',
                host: 'psms.id',
                title: 'Pemain PSMS Medan',
                description: 'Daftar pemain musim ini.',
            },
        })
        assert.include(sites.sentUrls, 'https://psms.id/favicon.ico')
    })

    test('mengizinkan beberapa link berbeda path pada domain yang sama', async ({
        client,
        assert,
    }) => {
        await createDomain({ host: 'dkwl.b-cdn.net', url: 'https://dkwl.b-cdn.net/latoto-kl1' })
        fakeRemoteSites({
            'https://dkwl.b-cdn.net/latoto-kl2': htmlPage(
                '<title>Halaman Kedua</title><body>Isi</body>'
            ),
            'https://dkwl.b-cdn.net/favicon.ico': { status: 404 },
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://dkwl.b-cdn.net/latoto-kl2' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({
            data: { url: 'https://dkwl.b-cdn.net/latoto-kl2', title: 'Halaman Kedua' },
        })
        assert.lengthOf(await Domain.query().where('host', 'dkwl.b-cdn.net'), 2)
    })

    test('menolak link yang sama walau beda skema, huruf, atau garis miring penutup: {$self}')
        .with(['psms.id/players', 'http://psms.id/players', 'https://PSMS.id/players/'])
        .run(async ({ client }, duplicate) => {
            fakeRemoteSites()
            const owner = await createUser()
            await createDomain({ host: 'psms.id', url: 'https://psms.id/players' }, owner)

            const response = await panel(client)
                .post('/api/v1/domains')
                .json({ url: duplicate })
                .withCsrfToken()
                .loginAs(owner)

            response.assertStatus(422)
            response.assertBodyContains({ errors: { url: ['Link ini sudah ada di daftar Anda.'] } })
        })

    test('memakai host sebagai judul dan cuplikan isi sebagai deskripsi bila situs tidak menyediakannya', async ({
        client,
    }) => {
        fakeRemoteSites({
            'polos.id/*': htmlPage('<html><body>Isi halaman sederhana tanpa meta.</body></html>'),
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://polos.id' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({
            data: {
                title: 'polos.id',
                description: 'Isi halaman sederhana tanpa meta.',
                logo_url: null,
            },
        })
    })

    test('tetap menyimpan domain tanpa logo bila ikon situs bukan gambar yang aman', async ({
        client,
        assert,
    }) => {
        fakeRemoteSites({
            'tokoku.com/logo.svg': {
                status: 200,
                body: '<svg><script>alert(1)</script></svg>',
                contentType: 'image/svg+xml',
            },
            'tokoku.com/*': htmlPage(
                '<html><head><title>Tokoku</title><link rel="icon" href="/logo.svg"></head><body>Halo</body></html>'
            ),
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://tokoku.com' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
        response.assertBodyContains({ data: { logo_url: null } })
        assert.equal(storage.files.size, 0)
    })

    test('menolak link yang situsnya tidak dapat dibuka', async ({ client, assert }) => {
        fakeRemoteSites({ 'mati.com/*': { status: 404, body: 'Not found' } })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://mati.com' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(422)
        response.assertBodyContains({
            success: false,
            errors: {
                url: [
                    'Situs tidak dapat dibuka (kode 404). Pastikan link benar dan situs sedang aktif.',
                ],
            },
        })
        assert.lengthOf(await Domain.all(), 0)
        assert.deepEqual(await queuedCrawlDomainIds(), [])
    })

    test('menolak link yang mengarah ke jaringan internal: {$self}')
        .with(['127.0.0.1', '10.1.2.3', '192.168.1.10', '169.254.169.254', '100.64.0.1'])
        .run(async ({ client, assert }, address) => {
            fakeDns(async () => [address])
            const sites = fakeRemoteSites()

            const response = await panel(client)
                .post('/api/v1/domains')
                .json({ url: 'https://jebakan.com' })
                .withCsrfToken()
                .loginAs(await createUser())

            response.assertStatus(422)
            response.assertBodyContains({
                errors: { url: ['Alamat mengarah ke jaringan internal dan tidak dapat diproses.'] },
            })
            assert.deepEqual(sites.sentUrls, [])
        })

    test('memvalidasi link di server', async ({ client }) => {
        fakeRemoteSites()

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'ftp://salah' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(422)
        response.assertBodyContains({
            errors: { url: ['link situs harus berupa alamat yang valid.'] },
        })
    })

    test('menolak link yang sudah didaftarkan akun lain', async ({ client }) => {
        fakeRemoteSites()
        await createDomain({ host: 'tokoku.com', url: 'https://tokoku.com' })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://tokoku.com' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(422)
        response.assertBodyContains({
            errors: { url: ['Link ini sudah didaftarkan oleh akun lain.'] },
        })
    })

    test('link milik domain yang sudah dihapus boleh didaftarkan lagi', async ({ client }) => {
        fakeRemoteSites(TOKOKU_SITE)
        await createDomain({
            host: 'tokoku.com',
            url: 'https://tokoku.com',
            deletedAt: DateTime.now(),
        })

        const response = await panel(client)
            .post('/api/v1/domains')
            .json({ url: 'https://tokoku.com' })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(201)
    })

    test('mengganti link lalu mengambil ulang data situs', async ({ client, assert }) => {
        fakeRemoteSites(TOKOKU_SITE)
        const user = await createUser()
        const domain = await createDomain(
            {
                host: 'lama.com',
                url: 'https://lama.com',
                title: 'Lama',
                logoPath: 'logos/lama.png',
            },
            user
        )
        storage.files.set('logos/lama.png', PNG_BYTES)
        await Page.create({
            domainId: domain.id,
            url: 'https://lama.com/',
            httpStatus: 200,
            crawledAt: DateTime.now(),
        })

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}`)
            .json({ url: 'https://tokoku.com' })
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(200)
        response.assertBodyContains({
            data: { title: 'Tokoku Resmi', pages_count: 0, crawl_status: 'pending' },
        })
        assert.isFalse(storage.files.has('logos/lama.png'))
        assert.deepEqual(await queuedCrawlDomainIds(), [domain.id])
    })

    test('mengganti link ke alamat yang sama tidak membuang halaman lama', async ({ client }) => {
        fakeRemoteSites(TOKOKU_SITE)
        const user = await createUser()
        const domain = await createDomain({ host: 'tokoku.com', url: 'https://tokoku.com' }, user)
        await Page.create({
            domainId: domain.id,
            url: 'https://tokoku.com/',
            httpStatus: 200,
            crawledAt: DateTime.now(),
        })

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}`)
            .json({ url: 'tokoku.com' })
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(200)
        response.assertBodyContains({ data: { pages_count: 1 } })
    })
})

test.group('Panel domain: daftar, hapus, promosi, dan pembaruan data', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        fakeDns()
        fakeObjectStorage()
        fakeRemoteSites()

        return () => restoreRemoteFakes()
    })

    test('hanya menampilkan domain milik sendiri dengan pagination', async ({ client, assert }) => {
        const user = await createUser()
        for (let index = 0; index < 3; index++) {
            await createDomain({}, user)
        }
        await createDomain()
        await createDomain({ deletedAt: DateTime.now() }, user)

        const response = await panel(client).get('/api/v1/domains?per_page=2').loginAs(user)

        response.assertStatus(200)
        assert.lengthOf(response.body().data.items, 2)
        response.assertBodyContains({
            data: { pagination: { page: 1, per_page: 2, total: 3, last_page: 2 } },
        })
    })

    test('melarang melihat, mengubah, dan menghapus domain milik orang lain', async ({
        client,
    }) => {
        const domain = await createDomain()
        const intruder = await createUser()

        const show = await panel(client).get(`/api/v1/domains/${domain.id}`).loginAs(intruder)
        const update = await panel(client)
            .put(`/api/v1/domains/${domain.id}`)
            .json({ url: 'https://lain.com' })
            .withCsrfToken()
            .loginAs(intruder)
        const destroy = await panel(client)
            .delete(`/api/v1/domains/${domain.id}`)
            .withCsrfToken()
            .loginAs(intruder)
        const crawl = await panel(client)
            .post(`/api/v1/domains/${domain.id}/crawls`)
            .withCsrfToken()
            .loginAs(intruder)

        for (const response of [show, update, destroy, crawl]) {
            response.assertStatus(403)
            response.assertBodyContains({
                success: false,
                message: 'Anda tidak berhak mengakses data ini.',
            })
        }
    })

    test('menjawab 404 untuk domain yang tidak ada atau sudah dihapus', async ({ client }) => {
        const user = await createUser()
        const deleted = await createDomain({ deletedAt: DateTime.now() }, user)

        const deletedResponse = await panel(client)
            .get(`/api/v1/domains/${deleted.id}`)
            .loginAs(user)
        const missingResponse = await panel(client)
            .get('/api/v1/domains/999999999')
            .loginAs(user)

        deletedResponse.assertStatus(404)
        missingResponse.assertStatus(404)
    })

    test('menolak permintaan tanpa login', async ({ client }) => {
        const response = await panel(client).get('/api/v1/domains')

        response.assertStatus(401)
    })

    test('menghapus domain secara lunak', async ({ client, assert }) => {
        const user = await createUser()
        const domain = await createDomain({}, user)

        const response = await panel(client)
            .delete(`/api/v1/domains/${domain.id}`)
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(200)
        response.assertBodyContains({ success: true, message: 'Domain berhasil dihapus' })
        await domain.refresh()
        assert.isNotNull(domain.deletedAt)
        assert.equal(domain.updatedBy, user.id)
    })

    test('menjadwalkan pembaruan data bila tidak sedang berjalan', async ({ client, assert }) => {
        const user = await createUser()
        const domain = await createDomain({ crawlStatus: 'done' }, user)

        const response = await panel(client)
            .post(`/api/v1/domains/${domain.id}/crawls`)
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(201)
        response.assertBodyContains({ data: { crawl_status: 'pending' } })
        assert.deepEqual(await queuedCrawlDomainIds(), [domain.id])
    })

    test('menolak pembaruan data yang masih berjalan', async ({ client, assert }) => {
        const user = await createUser()
        const domain = await createDomain({ crawlStatus: 'crawling' }, user)

        const response = await panel(client)
            .post(`/api/v1/domains/${domain.id}/crawls`)
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(422)
        response.assertBodyContains({
            errors: {
                crawl: ['Pembaruan data untuk domain ini sedang berjalan. Tunggu hingga selesai.'],
            },
        })
        assert.deepEqual(await queuedCrawlDomainIds(), [])
    })

    test('menandai dan menghentikan promosi link milik sendiri', async ({ client, assert }) => {
        const user = await createUser()
        const domain = await createDomain({}, user)

        const promote = await panel(client)
            .put(`/api/v1/domains/${domain.id}/promotion`)
            .json({ is_promoted: true })
            .withCsrfToken()
            .loginAs(user)
        promote.assertStatus(200)
        promote.assertBodyContains({
            message: 'Link sekarang dipromosikan',
            data: { is_promoted: true },
        })

        const stop = await panel(client)
            .put(`/api/v1/domains/${domain.id}/promotion`)
            .json({ is_promoted: false })
            .withCsrfToken()
            .loginAs(user)
        stop.assertStatus(200)
        stop.assertBodyContains({
            message: 'Promosi link dihentikan',
            data: { is_promoted: false },
        })

        await domain.refresh()
        assert.equal(domain.updatedBy, user.id)
    })

    test('melarang mempromosikan link milik orang lain', async ({ client, assert }) => {
        const domain = await createDomain()

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}/promotion`)
            .json({ is_promoted: true })
            .withCsrfToken()
            .loginAs(await createUser())

        response.assertStatus(403)
        await domain.refresh()
        assert.isFalse(domain.isPromoted)
    })

    test('memvalidasi status promosi', async ({ client, assert }) => {
        const user = await createUser()
        const domain = await createDomain({}, user)

        const response = await panel(client)
            .put(`/api/v1/domains/${domain.id}/promotion`)
            .json({ is_promoted: 'mungkin' })
            .withCsrfToken()
            .loginAs(user)

        response.assertStatus(422)
        assert.property(response.body().errors, 'is_promoted')
    })

    test('mencari link milik sendiri berdasarkan judul atau alamat', async ({ client }) => {
        const user = await createUser()
        await createDomain(
            { title: 'Toko Kopi', url: 'https://kopi.test', host: 'kopi.test' },
            user
        )
        await createDomain(
            {
                title: 'Situs Lain',
                url: 'https://dkwl.b-cdn.net/latoto-kl1',
                host: 'dkwl.b-cdn.net',
            },
            user
        )
        await createDomain(
            { title: 'Berita', url: 'https://berita.test', host: 'berita.test' },
            user
        )
        await createDomain({
            title: 'Kopi Orang Lain',
            url: 'https://kopi-lain.test',
            host: 'kopi-lain.test',
        })

        const byTitle = await panel(client).get('/api/v1/domains?q=kopi').loginAs(user)
        byTitle.assertStatus(200)
        byTitle.assertBodyContains({
            data: { pagination: { total: 1 }, items: [{ title: 'Toko Kopi' }] },
        })

        const byUrl = await panel(client).get('/api/v1/domains?q=latoto-kl1').loginAs(user)
        byUrl.assertStatus(200)
        byUrl.assertBodyContains({
            data: {
                pagination: { total: 1 },
                items: [{ url: 'https://dkwl.b-cdn.net/latoto-kl1' }],
            },
        })
    })

    test('memperlakukan karakter wildcard di pencarian link sebagai teks biasa', async ({
        client,
    }) => {
        const user = await createUser()
        await createDomain({ title: 'Toko Kopi' }, user)

        const response = await panel(client).get('/api/v1/domains?q=%25').loginAs(user)

        response.assertStatus(200)
        response.assertBodyContains({ data: { pagination: { total: 0 } } })
    })
})
