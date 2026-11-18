import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import { panel, search } from '#tests/helpers'

test.group('Cookie per domain', (group) => {
    group.each.setup(() => limiter.clear(['memory']))

    test('domain pencarian tidak memberi cookie tetapi tetap mengirim header keamanan', async ({
        client,
        assert,
    }) => {
        for (const path of ['/', '/cari?q=kopi', '/api/v1/search-results?q=kopi']) {
            const response = await search(client).get(path)

            assert.isUndefined(response.header('set-cookie'), path)
            assert.include(response.header('content-security-policy'), "default-src 'self'", path)
            assert.equal(response.header('x-frame-options'), 'DENY', path)
        }
    })

    test('panel tetap memberi cookie sesi dan token CSRF', async ({ client, assert }) => {
        const response = await panel(client).get('/masuk')
        assert.include(String(response.header('set-cookie')), 'XSRF-TOKEN')
    })
})
