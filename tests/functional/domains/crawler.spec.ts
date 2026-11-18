import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'
import CrawlDomainJob from '#jobs/crawl_domain_job'
import type Domain from '#models/domain'
import Page from '#models/page'
import DomainCrawler from '#services/domain_crawler'
import { createDomain } from '#tests/functional/domains/domain_helpers'
import { fakeDns, fakeRemoteSites, htmlPage, restoreRemoteFakes } from '#tests/fakes/remote_sites'

async function crawl(domainId: number) {
    const job = await app.container.make(CrawlDomainJob)
    await job.handle({ domainId })
}

async function crawlPages(domain: Domain): Promise<number> {
    const crawler = await app.container.make(DomainCrawler)

    return crawler.crawl(domain)
}

async function pageUrls(domainId?: number): Promise<string[]> {
    const pages = await Page.query()
        .if(domainId !== undefined, (query) => query.where('domain_id', domainId as number))
        .orderBy('url')

    return pages.map((page) => page.url)
}

test.group('Crawler', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        fakeDns()

        return () => restoreRemoteFakes()
    })

    test('menelusuri halaman pada host yang sama dan mematuhi robots.txt', async ({ assert }) => {
        const domain = await createDomain({ url: 'https://tokoku.com', host: 'tokoku.com' })
        const sites = fakeRemoteSites({
            'tokoku.com/robots.txt': {
                status: 200,
                body: 'User-agent: *\nDisallow: /admin',
                contentType: 'text/plain',
            },
            'tokoku.com/produk': htmlPage(
                '<title>Produk</title><body>Wajan anti lengket berkualitas <a href="/">Beranda</a></body>'
            ),
            'tokoku.com/admin': htmlPage('<title>Admin</title><body>Rahasia</body>'),
            'tokoku.com/': htmlPage(
                '<html><head><title>Tokoku</title><meta name="description" content="Toko perabot"></head>' +
                    '<body><script>var x = 1;</script>Selamat datang' +
                    '<a href="/produk#atas">Produk</a><a href="/admin">Admin</a><a href="https://lain.com/">Luar</a></body></html>'
            ),
        })

        const savedCount = await crawlPages(domain)

        assert.equal(savedCount, 2)
        assert.deepEqual(await pageUrls(), ['https://tokoku.com/', 'https://tokoku.com/produk'])
        const homepage = await Page.findByOrFail('url', 'https://tokoku.com/')
        assert.equal(homepage.title, 'Tokoku')
        assert.equal(homepage.description, 'Toko perabot')
        assert.notInclude(homepage.content ?? '', 'var x')
        assert.isFalse(sites.hasSent((url) => url.includes('lain.com') || url.includes('/admin')))
    })

    test('memperbarui data situs dan menandai selesai setelah job berjalan', async ({ assert }) => {
        const domain = await createDomain({
            url: 'https://tokoku.com',
            host: 'tokoku.com',
            crawlStatus: 'pending',
        })
        fakeRemoteSites({
            'tokoku.com/robots.txt': { status: 404 },
            'tokoku.com/*': htmlPage(
                '<title>Tokoku Baru</title><meta name="keywords" content="perabot"><body>Halo</body>'
            ),
        })

        await crawl(domain.id)

        await domain.refresh()
        await domain.load('tags')
        assert.equal(domain.crawlStatus, 'done')
        assert.equal(domain.title, 'Tokoku Baru')
        assert.deepEqual(
            domain.tags.map((tag) => tag.name),
            ['perabot']
        )
        assert.isNotNull(domain.lastCrawledAt)
    })

    test('menandai crawl gagal bila halaman utama tidak dapat dibaca', async ({ assert }) => {
        const domain = await createDomain({ url: 'https://tokoku.com', host: 'tokoku.com' })
        fakeRemoteSites({ 'tokoku.com/*': { status: 500, body: 'Server error' } })

        await crawl(domain.id)

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'failed')
    })

    test('mulai menelusuri dari path yang didaftarkan dan membaca robots.txt dari akar situs', async ({
        assert,
    }) => {
        const domain = await createDomain({ url: 'https://psms.id/players', host: 'psms.id' })
        const sites = fakeRemoteSites({
            'https://psms.id/robots.txt': {
                status: 200,
                body: 'User-agent: *\nDisallow: /admin',
                contentType: 'text/plain',
            },
            'https://psms.id/players': htmlPage(
                '<title>Pemain</title><body>Skuad <a href="/players/kiper">Kiper</a></body>'
            ),
            'https://psms.id/players/kiper': htmlPage(
                '<title>Kiper</title><body>Penjaga gawang</body>'
            ),
        })

        await crawlPages(domain)

        assert.deepEqual(await pageUrls(), [
            'https://psms.id/players',
            'https://psms.id/players/kiper',
        ])
        assert.include(sites.sentUrls, 'https://psms.id/robots.txt')
        assert.notInclude(sites.sentUrls, 'https://psms.id/players/robots.txt')
    })

    test('hanya menelusuri halaman di bawah path yang didaftarkan', async ({ assert }) => {
        const domain = await createDomain({
            url: 'https://dkwl.b-cdn.net/latoto-kl1',
            host: 'dkwl.b-cdn.net',
        })
        const sites = fakeRemoteSites({
            'https://dkwl.b-cdn.net/robots.txt': { status: 404 },
            'https://dkwl.b-cdn.net/latoto-kl1': htmlPage(
                '<title>KL1</title><body>' +
                    '<a href="/latoto-kl1/promo">Promo</a>' +
                    '<a href="/latoto-kl10">Lain</a>' +
                    '<a href="/latoto-kl2">Situs lain</a></body>'
            ),
            'https://dkwl.b-cdn.net/latoto-kl1/promo': htmlPage(
                '<title>Promo</title><body>Isi promo</body>'
            ),
        })

        await crawlPages(domain)

        assert.deepEqual(await pageUrls(), [
            'https://dkwl.b-cdn.net/latoto-kl1',
            'https://dkwl.b-cdn.net/latoto-kl1/promo',
        ])
        assert.notInclude(sites.sentUrls, 'https://dkwl.b-cdn.net/latoto-kl10')
        assert.notInclude(sites.sentUrls, 'https://dkwl.b-cdn.net/latoto-kl2')
    })

    test('menyimpan halaman yang sama untuk dua entri tanpa saling menimpa', async ({ assert }) => {
        const wholeSite = await createDomain({ url: 'https://tokoku.com', host: 'tokoku.com' })
        const blogOnly = await createDomain({ url: 'https://tokoku.com/blog', host: 'tokoku.com' })
        fakeRemoteSites({
            'https://tokoku.com/robots.txt': { status: 404 },
            'https://tokoku.com/': htmlPage(
                '<title>Beranda</title><body><a href="/blog">Blog</a></body>'
            ),
            'https://tokoku.com/blog': htmlPage('<title>Blog</title><body>Artikel</body>'),
        })
        const crawler = await app.container.make(DomainCrawler)

        await crawler.crawl(wholeSite)
        await crawler.crawl(blogOnly)

        assert.deepEqual(await pageUrls(wholeSite.id), [
            'https://tokoku.com/',
            'https://tokoku.com/blog',
        ])
        assert.deepEqual(await pageUrls(blogOnly.id), ['https://tokoku.com/blog'])
    })

    test('membuang halaman lama yang tidak ditemukan lagi', async ({ assert }) => {
        const domain = await createDomain({ url: 'https://tokoku.com', host: 'tokoku.com' })
        fakeRemoteSites({
            'https://tokoku.com/robots.txt': { status: 404 },
            'https://tokoku.com/': htmlPage('<title>Beranda</title><body>Halo</body>'),
        })
        await Page.create({
            domainId: domain.id,
            url: 'https://tokoku.com/lama',
            httpStatus: 200,
            crawledAt: domain.createdAt,
        })

        await crawlPages(domain)

        assert.deepEqual(await pageUrls(domain.id), ['https://tokoku.com/'])
    })

    test('tidak mengikuti redirect ke jaringan internal', async ({ assert }) => {
        fakeDns(async (host) => (host === 'internal.tokoku.com' ? ['10.0.0.5'] : ['93.184.216.34']))
        const domain = await createDomain({ url: 'https://tokoku.com', host: 'tokoku.com' })
        const sites = fakeRemoteSites({
            'tokoku.com/robots.txt': { status: 404 },
            'tokoku.com/': { status: 302, location: 'https://internal.tokoku.com/' },
        })

        await assert.rejects(() => crawlPages(domain), RemoteFetchException)
        assert.isFalse(sites.hasSent((url) => url.includes('internal.tokoku.com')))
    })

    test('menandai link yang mengalihkan ke domain lain sebagai dialihkan beserta tujuannya', async ({
        assert,
    }) => {
        const domain = await createDomain({
            url: 'https://pengalih.test/promo',
            host: 'pengalih.test',
        })
        fakeRemoteSites({
            'https://pengalih.test/robots.txt': { status: 404 },
            // Crawl ulang juga memperbarui logo dari situs; situs ini tidak punya ikon.
            'https://pengalih.test/favicon.ico': { status: 404 },
            'https://pengalih.test/promo': { status: 302, location: 'https://tujuan-lain.test/' },
            'https://tujuan-lain.test/': htmlPage('<title>Situs Tujuan</title><body>Isi</body>'),
        })

        await crawl(domain.id)

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'redirected')
        assert.equal(domain.redirectedTo, 'https://tujuan-lain.test/')
        assert.deepEqual(await pageUrls(domain.id), [])
    })

    test('menandai link pengalih ke situs yang memblokir bot sebagai dialihkan tanpa mengubah datanya', async ({
        assert,
    }) => {
        const domain = await createDomain({
            url: 'https://dkwl.b-cdn.net/mariatogel-kl1',
            host: 'dkwl.b-cdn.net',
            title: 'mariatogel-kl1',
        })
        fakeRemoteSites({
            'https://dkwl.b-cdn.net/mariatogel-kl1': {
                status: 302,
                location: 'https://dahlia.mariatogel788.life/',
            },
            'https://dahlia.mariatogel788.life/': { status: 403, body: 'Just a moment...' },
        })

        await crawl(domain.id)

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'redirected')
        assert.equal(domain.redirectedTo, 'https://dahlia.mariatogel788.life/')
        assert.equal(domain.title, 'mariatogel-kl1')
    })

    test('menghapus catatan pengalihan setelah link kembali bisa dibaca', async ({ assert }) => {
        const domain = await createDomain({
            url: 'https://pulih.test',
            host: 'pulih.test',
            crawlStatus: 'redirected',
            redirectedTo: 'https://lama.test/',
        })
        fakeRemoteSites({
            'https://pulih.test/robots.txt': { status: 404 },
            'https://pulih.test/*': htmlPage('<title>Pulih</title><body>Halo</body>'),
        })

        await crawl(domain.id)

        await domain.refresh()
        assert.equal(domain.crawlStatus, 'done')
        assert.isNull(domain.redirectedTo)
    })
})
