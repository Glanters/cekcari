import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import { panel, search } from '#tests/helpers'

test.group('Pemisahan domain pencarian dan panel', (group) => {
    group.each.setup(() => limiter.clear(['memory']))

    test('tidak menyediakan api pemilik domain di domain pencarian', async ({ client }) => {
        const domainList = await search(client).get('/api/v1/domains')
        domainList.assertStatus(404)
        domainList.assertBodyContains({ success: false })

        const login = await search(client).post('/api/v1/sessions')
        login.assertStatus(404)
    })

    test('tidak menyediakan api pencarian di domain panel', async ({ client }) => {
        const response = await panel(client).get('/api/v1/search-results?q=kopi')

        response.assertStatus(404)
        response.assertBodyContains({ success: false })
    })

    test('mengirim kerangka spa yang berbeda untuk tiap domain', async ({ client, assert }) => {
        const searchPage = await search(client).get('/cari')
        searchPage.assertStatus(200)
        assert.include(searchPage.text(), 'resources/js/search.js')
        assert.notInclude(searchPage.text(), 'resources/js/panel.js')

        const panelPage = await panel(client).get('/masuk')
        panelPage.assertStatus(200)
        assert.include(panelPage.text(), 'resources/js/panel.js')
        assert.notInclude(panelPage.text(), 'resources/js/search.js')
    })

    test('menjawab 404 untuk berkas build yang sudah tidak ada', async ({ client, assert }) => {
        for (const response of [
            await panel(client).get('/build/assets/DashboardLayout-lama.js'),
            await search(client).get('/build/assets/SearchHomePage-lama.js'),
        ]) {
            response.assertStatus(404)
            assert.notInclude(response.text(), '<div id="app">')
        }
    })

    test('tidak menjawab api yang tidak ada dengan kerangka spa', async ({ client }) => {
        const response = await search(client).get('/api/v1/tidak-ada')

        response.assertStatus(404)
        response.assertBodyContains({ success: false, message: 'Data tidak ditemukan.' })
    })

    test('menolak host yang tidak dikenal', async ({ client, assert }) => {
        const response = await client.get('/').header('Host', 'domain-lain.test')

        // Saat uji, server dev Vite sudah menolak host asing (403) sebelum router; di production router menjawab 404.
        assert.include([403, 404], response.status())
        assert.notInclude(response.text() ?? '', '<div id="app">')
    })
})
