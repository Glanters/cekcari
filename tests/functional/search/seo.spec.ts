import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { seo } from '#config/cekcari'
import { panel, search } from '#tests/helpers'

type ManifestIcon = { src: string; sizes: string; purpose: string }

test.group('SEO dan kerangka halaman', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => limiter.clear(['memory']))

    test('memberi beranda judul, deskripsi, canonical, open graph, dan data terstruktur', async ({
        client,
        assert,
    }) => {
        const response = await search(client).get('/')
        response.assertStatus(200)

        const html = response.text()
        assert.include(
            html,
            '<title>CekCari — Mesin Pencari Situs dan Halaman Web Indonesia</title>'
        )
        assert.include(
            html,
            '<meta name="description" content="Cari situs dan halaman web Indonesia'
        )
        assert.include(html, '<meta name="robots" content="index, follow">')
        assert.include(html, '<link rel="canonical" href="https://cekcari.com/">')
        assert.include(
            html,
            '<meta property="og:image" content="https://cekcari.com/images/brand/cekcari-logo-512.png">'
        )
        assert.include(html, 'application/ld+json')
        assert.include(html, '"@type":"WebSite","name":"CekCari","url":"https://cekcari.com/"')
        assert.include(html, '<html lang="id">')
        assert.notInclude(html, 'google-site-verification')
    })

    test('memberi data terstruktur nonce CSP yang sama dengan header', async ({
        client,
        assert,
    }) => {
        const response = await search(client).get('/')

        const nonce = /nonce="([^"]+)"/.exec(response.text())?.[1]
        assert.isString(nonce)
        assert.include(response.header('content-security-policy'), `'nonce-${nonce}'`)
    })

    test('memuat font dan aset sesuai domain', async ({ client, assert }) => {
        const response = await search(client).get('/')
        const html = response.text()

        assert.include(html, '<link rel="preload" href="/fonts/dm-sans-latin.woff2"')
        assert.notInclude(html, 'fonts.googleapis.com')
        assert.include(html, 'resources/js/search.js')
        assert.include(html, 'resources/css/app.css')
        assert.include(html, '<div id="app"></div>')
    })

    test('tidak mengindeks halaman hasil pencarian tetapi tetap mengikuti tautannya', async ({
        client,
        assert,
    }) => {
        const response = await search(client).get('/cari?q=kopi')
        response.assertStatus(200)

        const html = response.text()
        assert.include(html, '<title>kopi — Hasil pencarian CekCari</title>')
        assert.include(html, '<meta name="robots" content="noindex, follow">')
        assert.notInclude(html, 'rel="canonical"')
        assert.notInclude(html, 'application/ld+json')
    })

    test('memotong kata kunci yang terlalu panjang di judul halaman hasil', async ({
        client,
        assert,
    }) => {
        const response = await search(client).get(`/cari?q=${'a'.repeat(80)}`)

        assert.include(
            response.text(),
            `<title>${'a'.repeat(60)}... — Hasil pencarian CekCari</title>`
        )
    })

    test('mengamankan kata kunci di judul halaman hasil', async ({ client, assert }) => {
        const response = await search(client).get('/cari?q=%3Cscript%3Ealert(1)%3C/script%3E')
        response.assertStatus(200)

        const html = response.text()
        assert.notInclude(html, '<script>alert(1)</script>')
        assert.include(html, '&lt;script&gt;alert(1)&lt;/script&gt;')
    })

    test('menjawab 404 sungguhan untuk halaman yang tidak ada di domain pencarian', async ({
        client,
        assert,
    }) => {
        const response = await search(client).get('/halaman-acak')

        response.assertStatus(404)
        assert.include(response.text(), '<meta name="robots" content="noindex, follow">')
        assert.include(response.text(), '<title>Halaman tidak ditemukan — CekCari</title>')
    })

    test('menyediakan robots.txt dan sitemap.xml untuk domain pencarian', async ({
        client,
        assert,
    }) => {
        const robots = await search(client).get('/robots.txt')
        robots.assertStatus(200)
        assert.equal(robots.header('content-type'), 'text/plain; charset=UTF-8')
        assert.include(robots.text(), 'Disallow: /api/\n')
        assert.include(robots.text(), 'Sitemap: https://cekcari.com/sitemap.xml')

        const sitemap = await search(client).get('/sitemap.xml')
        sitemap.assertStatus(200)
        assert.equal(sitemap.header('content-type'), 'application/xml; charset=UTF-8')
        assert.include(sitemap.text(), '<loc>https://cekcari.com/</loc>')
        assert.notInclude(sitemap.text(), '/cari')
    })

    test('menutup seluruh domain panel dari mesin pencari', async ({ client, assert }) => {
        const robots = await panel(client).get('/robots.txt')
        robots.assertStatus(200)
        assert.include(robots.text(), 'User-agent: *\nDisallow: /')

        for (const path of ['/', '/masuk', '/dasbor/domain']) {
            const page = await panel(client).get(path)
            page.assertStatus(200)
            assert.equal(page.header('x-robots-tag'), 'noindex, nofollow')
            assert.include(page.text(), '<meta name="robots" content="noindex, nofollow">')
            assert.notInclude(page.text(), 'application/ld+json')
        }
    })

    test('menampilkan tag verifikasi Google Search Console bila diisi', async ({
        client,
        assert,
        cleanup,
    }) => {
        const original = seo.googleSiteVerification
        seo.googleSiteVerification = 'kode-verifikasi-uji'
        cleanup(() => {
            seo.googleSiteVerification = original
        })

        const response = await search(client).get('/')

        assert.include(
            response.text(),
            '<meta name="google-site-verification" content="kode-verifikasi-uji">'
        )
    })

    test('menjadikan domain pencarian bisa dipasang sebagai aplikasi, tetapi tidak panel', async ({
        client,
        assert,
    }) => {
        const searchHome = await search(client).get('/')
        searchHome.assertStatus(200)
        assert.include(searchHome.text(), '<link rel="manifest" href="/manifest.webmanifest">')
        assert.include(
            searchHome.text(),
            '<meta name="apple-mobile-web-app-capable" content="yes">'
        )
        assert.include(
            searchHome.text(),
            '<meta name="apple-mobile-web-app-title" content="CekCari">'
        )

        const panelLogin = await panel(client).get('/masuk')
        panelLogin.assertStatus(200)
        assert.notInclude(panelLogin.text(), 'rel="manifest"')
        assert.notInclude(panelLogin.text(), 'apple-mobile-web-app-capable')
    })

    test('menyediakan manifest dan ikon PWA yang lengkap', async ({ assert }) => {
        const manifest = JSON.parse(await readFile(app.publicPath('manifest.webmanifest'), 'utf8'))

        assert.isNotEmpty(manifest.name)
        assert.equal(manifest.short_name, 'CekCari')
        assert.equal(manifest.start_url, '/')
        assert.equal(manifest.display, 'standalone')

        const icons = manifest.icons as ManifestIcon[]
        const sizesFor = (purpose: string) =>
            icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes)
        assert.includeMembers(sizesFor('any'), ['192x192', '512x512'])
        assert.includeMembers(sizesFor('maskable'), ['192x192', '512x512'])

        for (const icon of icons) {
            assert.isTrue(
                existsSync(app.publicPath(icon.src.replace(/^\//, ''))),
                `${icon.src} tidak ada`
            )
        }

        assert.isTrue(existsSync(app.publicPath('sw.js')))
    })

    test('melayani berkas statis PWA sebelum rute catch-all', async ({ client, assert }) => {
        for (const path of ['/manifest.webmanifest', '/sw.js', '/favicon.ico']) {
            const response = await search(client).get(path)

            response.assertStatus(200)
            assert.notInclude(response.header('content-type') ?? '', 'text/html')
        }
    })

    test('mengirim header keamanan dasar di semua domain', async ({ client, assert }) => {
        const responses = [
            await search(client).get('/'),
            await panel(client).get('/masuk'),
            await search(client).get('/api/v1/search-results?q=kopi'),
        ]

        for (const response of responses) {
            assert.equal(response.header('x-frame-options'), 'DENY')
            assert.equal(response.header('x-content-type-options'), 'nosniff')
            assert.equal(response.header('referrer-policy'), 'strict-origin-when-cross-origin')
        }
    })
})

test.group('SEO: server uji tidak diindeks', (group) => {
    group.each.setup(() => {
        seo.isIndexingAllowed = false

        return () => {
            seo.isIndexingAllowed = true
        }
    })

    test('semua halaman noindex dan robots.txt menutup seluruh situs', async ({
        client,
        assert,
    }) => {
        const home = await search(client).get('/')
        home.assertStatus(200)
        home.assertHeader('x-robots-tag', 'noindex, nofollow')
        assert.include(home.text(), '<meta name="robots" content="noindex, nofollow">')
        assert.notInclude(home.text(), 'rel="canonical"')

        const robots = await search(client).get('/robots.txt')
        assert.equal(robots.text(), 'User-agent: *\nDisallow: /\n')
    })
})
