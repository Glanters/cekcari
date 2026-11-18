import { test } from '@japa/runner'
import { panel, search } from '#tests/helpers'

test.group('Kerangka aplikasi', () => {
    test('menjawab cek kesehatan di kedua domain', async ({ client }) => {
        const fromSearch = await search(client).get('/up')
        fromSearch.assertStatus(200)
        fromSearch.assertBodyContains({ status: 'ok' })

        const fromPanel = await panel(client).get('/up')
        fromPanel.assertStatus(200)
    })

    test('mengirim header keamanan dasar', async ({ client, assert }) => {
        const response = await search(client).get('/up')

        assert.equal(response.header('x-frame-options'), 'DENY')
        assert.equal(response.header('x-content-type-options'), 'nosniff')
        assert.equal(response.header('referrer-policy'), 'strict-origin-when-cross-origin')
    })
})
