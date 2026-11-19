import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { search } from '#tests/helpers'
import { HIGHLIGHT_END, HIGHLIGHT_START } from '#services/search_service'
import {
    attachTag,
    createDomain,
    createDomains,
    createPage,
    softDelete,
} from '#tests/functional/search/fixtures'

type ResultItem = {
    id: number
    host: string
    description: string
    related_pages: { url: string; snippet: string }[]
}

test.group('API pencarian', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    // Batas 120 permintaan per menit per IP tidak boleh terbawa dari test sebelumnya.
    group.each.setup(() => limiter.clear(['memory']))

    test('menampilkan domain yang terdaftar dan menyembunyikan yang sudah dihapus', async ({
        client,
    }) => {
        await createDomain({ title: 'Kopi Nusantara', host: 'kopinusantara.id' })
        await softDelete(await createDomain({ title: 'Kopi Lama', host: 'kopilama.id' }))

        const response = await search(client).get('/api/v1/search-results?q=kopi')

        response.assertStatus(200)
        response.assertBodyContains({
            success: true,
            data: {
                pagination: { total: 1 },
                items: [{ host: 'kopinusantara.id' }],
                is_fuzzy: false,
            },
        })
    })

    test('menemukan domain dari isi halaman hasil crawl beserta cuplikan bersorot', async ({
        client,
        assert,
    }) => {
        const domain = await createDomain({
            title: 'Tokoku',
            host: 'tokoku.com',
            description: 'Toko perabot rumah tangga lengkap',
        })
        await createPage(domain, {
            url: 'https://tokoku.com/wajan',
            title: 'Wajan',
            content: 'Wajan anti lengket dengan lapisan keramik untuk memasak sehari-hari.',
        })

        const response = await search(client).get('/api/v1/search-results?q=keramik')
        response.assertStatus(200)

        const [first] = response.body().data.items as ResultItem[]
        assert.equal(first.id, Number(domain.id))
        assert.equal(first.related_pages[0].url, 'https://tokoku.com/wajan')
        assert.include(first.related_pages[0].snippet, `${HIGHLIGHT_START}keramik${HIGHLIGHT_END}`)
    })

    test('tidak mengulang halaman utama sebagai halaman terkait dan mengirim deskripsi utuh', async ({
        client,
        assert,
    }) => {
        const description =
            'Situs ini berisi panduan lengkap memasak rendang untuk pemula di rumah.'
        const domain = await createDomain({
            url: 'https://resep.id',
            host: 'resep.id',
            description,
        })
        await createPage(domain, {
            url: 'https://resep.id/',
            title: 'Beranda',
            content: 'Panduan rendang',
        })
        await createPage(domain, {
            url: 'https://resep.id/rendang',
            title: 'Rendang',
            content: 'Resep rendang padang',
        })

        const response = await search(client).get('/api/v1/search-results?q=rendang')
        response.assertStatus(200)

        const [first] = response.body().data.items as ResultItem[]
        assert.lengthOf(first.related_pages, 1)
        assert.equal(first.related_pages[0].url, 'https://resep.id/rendang')
        assert.equal(
            first.description.replaceAll(HIGHLIGHT_START, '').replaceAll(HIGHLIGHT_END, ''),
            description
        )
    })

    test('menemukan situs yang nama atau host-nya diawali kata kunci', async ({
        client,
        assert,
    }) => {
        await createDomain({ title: 'JUTAWANBET Resmi', host: 'jutawanbet.com' })
        await createDomain({ title: 'Situs Hoki', host: 'jutawan81605.com' })
        await createDomain({ title: 'Kopi Nusantara', host: 'kopinusantara.id' })

        const response = await search(client).get('/api/v1/search-results?q=jutawan')

        response.assertStatus(200)
        const payload = response.body().data
        assert.equal(payload.pagination.total, 2)
        assert.isFalse(payload.is_fuzzy)
        assert.sameMembers(
            (payload.items as ResultItem[]).map((item) => item.host),
            ['jutawanbet.com', 'jutawan81605.com']
        )
    })

    test('kata kunci di bawah 3 huruf tidak dicocokkan sebagai awalan', async ({
        client,
        assert,
    }) => {
        await createDomain({ title: 'Kopi Nusantara', host: 'kopinusantara.id' })

        const response = await search(client).get('/api/v1/search-results?q=ko&exact=true')

        const payload = response.body().data
        assert.isTrue(payload.is_fuzzy || payload.pagination.total === 0)
    })

    test('situs yang namanya cocok tampil sebelum situs yang cocok hanya dari isi halamannya', async ({
        client,
        assert,
    }) => {
        const pageOnlyDomains = await createDomains(4, { title: 'Situs Lain' })
        for (const domain of pageOnlyDomains) {
            await createPage(domain, {
                url: `https://${domain.host}/bonus`,
                title: 'Bonus',
                content: 'Promo jutawan setiap hari.',
            })
        }
        const namedDomain = await createDomain({ title: 'Jutawan Resmi', host: 'jutawan.id' })

        for (const seed of [1, 2, 3, 4, 5]) {
            const response = await search(client).get(
                `/api/v1/search-results?q=jutawan&seed=${seed}`
            )
            const [first] = response.body().data.items as ResultItem[]

            assert.equal(first.id, Number(namedDomain.id))
        }
    })

    test('menemukan domain dari tag', async ({ client }) => {
        const domain = await createDomain({
            title: 'Situs A',
            description: 'Deskripsi umum situs tanpa kata kunci',
        })
        await attachTag(domain, 'kuliner')

        const response = await search(client).get('/api/v1/search-results?q=kuliner')

        response.assertStatus(200)
        response.assertBodyContains({
            data: { items: [{ id: Number(domain.id) }] },
        })
    })

    test('memberi hasil mirip bila kata kunci salah ketik', async ({ client }) => {
        const domain = await createDomain({ title: 'Tokopedia', host: 'tokopedia.com' })

        const response = await search(client).get('/api/v1/search-results?q=tokopedya')

        response.assertStatus(200)
        // Salah ketik dikoreksi ke kata yang ada di CekCari; nama mirip hanya jalan terakhir.
        response.assertBodyContains({
            data: {
                corrected_query: 'tokopedia',
                is_fuzzy: false,
                items: [{ id: Number(domain.id) }],
            },
        })
    })

    test('memvalidasi kata kunci pencarian', async ({ client, assert }) => {
        for (const path of ['/api/v1/search-results', '/api/v1/search-results?q=%20%20']) {
            const response = await search(client).get(path)

            response.assertStatus(422)
            assert.properties(response.body().errors, ['q'])
        }
    })

    test('memvalidasi seed urutan', async ({ client, assert }) => {
        for (const seed of ['abc', '0', '2147483648']) {
            const response = await search(client).get(`/api/v1/search-results?q=kopi&seed=${seed}`)

            response.assertStatus(422)
            assert.properties(response.body().errors, ['seed'])
        }
    })

    test('memvalidasi page dan per_page', async ({ client, assert }) => {
        const response = await search(client).get(
            '/api/v1/search-results?q=kopi&page=0&per_page=51'
        )

        response.assertStatus(422)
        assert.properties(response.body().errors, ['page', 'per_page'])
    })

    test('menaruh satu link promosi yang cocok di slot teratas dan tidak mengulangnya di daftar', async ({
        client,
        assert,
    }) => {
        const promotedDomain = await createDomain({ title: 'Kopi Promo', isPromoted: true })
        await createDomains(3, { title: 'Kopi Biasa' })
        await createDomain({ title: 'Teh Promo', isPromoted: true })

        const response = await search(client).get('/api/v1/search-results?q=kopi&seed=12345')
        response.assertStatus(200)

        const payload = response.body().data
        assert.equal(payload.promoted.id, Number(promotedDomain.id))
        assert.notInclude(
            (payload.items as ResultItem[]).map((item) => item.id),
            Number(promotedDomain.id)
        )
        assert.equal(payload.pagination.total, 3)
    })

    test('tidak menampilkan slot promosi bila tidak ada link promosi yang cocok', async ({
        client,
    }) => {
        await createDomain({ title: 'Kopi Biasa' })
        await createDomain({ title: 'Teh Promo', isPromoted: true })

        const response = await search(client).get('/api/v1/search-results?q=kopi')

        response.assertStatus(200)
        response.assertBodyContains({ data: { promoted: null } })
    })

    test('memilih link promosi secara acak di antara yang cocok', async ({ client, assert }) => {
        const promotedDomains = await createDomains(5, { title: 'Kopi Promo', isPromoted: true })
        const promotedIds = promotedDomains.map((domain) => Number(domain.id))
        const pickedIds = new Set<number>()

        for (let seed = 1; seed <= 40; seed++) {
            const response = await search(client).get(`/api/v1/search-results?q=kopi&seed=${seed}`)
            pickedIds.add(response.body().data.promoted.id)
        }

        assert.isAbove(pickedIds.size, 1)
        assert.includeMembers(promotedIds, [...pickedIds])
    })

    test('mengacak urutan per seed tetapi konsisten antarhalaman untuk seed yang sama', async ({
        client,
        assert,
    }) => {
        const rollingDomains = await createDomains(12, { title: 'Kopi Rolling' })
        const allIds = rollingDomains.map((domain) => Number(domain.id))

        const orderFor = async (seed: number) => {
            const ids: number[] = []

            for (const page of [1, 2, 3]) {
                const response = await search(client).get(
                    `/api/v1/search-results?q=kopi&seed=${seed}&per_page=5&page=${page}`
                )
                ids.push(...(response.body().data.items as ResultItem[]).map((item) => item.id))
            }

            return ids
        }

        const firstVisitor = await orderFor(111)

        assert.sameMembers(firstVisitor, allIds)
        assert.lengthOf(firstVisitor, allIds.length)
        assert.deepEqual(await orderFor(111), firstVisitor)
        assert.notDeepEqual(await orderFor(222), firstVisitor)
    })

    test('situs mirror dengan judul dan deskripsi sama tampil dengan teks berbeda', async ({
        client,
        assert,
    }) => {
        const mirror = {
            title: 'DEPOBOS LINK GAME ONLINE TERPERCAYA',
            description: 'DEPOBOS adalah bandar online terlengkap. Satu nama terus mencuat.',
        }
        const original = await createDomain({
            ...mirror,
            host: 'depobos90.com',
            url: 'https://depobos90.com',
        })
        await createDomain({ ...mirror, host: 'depobos45.com', url: 'https://depobos45.com' })
        await createDomain({ ...mirror, host: 'depobos19.com', url: 'https://depobos19.com' })
        await createDomain({ title: 'Kopi Depobos', host: 'kopi.id', url: 'https://kopi.id' })

        const response = await search(client).get('/api/v1/search-results?q=depobos')
        response.assertStatus(200)

        const plain = (text: string) =>
            text.replaceAll(HIGHLIGHT_START, '').replaceAll(HIGHLIGHT_END, '')
        const items = response.body().data.items as (ResultItem & { title: string })[]
        const byHost = new Map(items.map((item) => [item.host, item]))

        assert.equal(plain(byHost.get('depobos90.com')!.title), mirror.title)
        assert.equal(plain(byHost.get('depobos90.com')!.description), mirror.description)
        assert.equal(
            plain(byHost.get('depobos45.com')!.title),
            'DEPOBOS — Link Alternatif depobos45.com'
        )
        assert.equal(plain(byHost.get('depobos19.com')!.title), 'depobos19.com | DEPOBOS')
        assert.include(plain(byHost.get('depobos45.com')!.description), 'depobos45.com')
        assert.equal(plain(byHost.get('kopi.id')!.title), 'Kopi Depobos')
        assert.lengthOf(new Set(items.map((item) => plain(item.title))), 4)
        assert.lengthOf(new Set(items.map((item) => plain(item.description))), 4)
        // Kata kunci tetap disorot di teks variasi; data asli di database tidak berubah.
        assert.include(
            byHost.get('depobos45.com')!.title,
            `${HIGHLIGHT_START}DEPOBOS${HIGHLIGHT_END}`
        )
        await original.refresh()
        assert.equal(original.title, mirror.title)
    })

    test('mengirim penanda sorotan dan bentuk pagination standar', async ({ client }) => {
        await createDomain({ title: 'Kopi Nusantara' })

        const response = await search(client).get('/api/v1/search-results?q=kopi')

        response.assertStatus(200)
        response.assertBodyContains({
            success: true,
            message: 'Hasil pencarian berhasil diambil',
            data: {
                items: [
                    {
                        title: `${HIGHLIGHT_START}Kopi${HIGHLIGHT_END} Nusantara`,
                        related_pages: [],
                    },
                ],
                pagination: { page: 1, per_page: 10, total: 1, last_page: 1 },
                highlight: { start: HIGHLIGHT_START, end: HIGHLIGHT_END },
            },
        })
    })
})
