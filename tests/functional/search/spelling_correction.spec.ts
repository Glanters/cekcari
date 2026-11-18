import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { search } from '#tests/helpers'
import SpellingCorrector from '#services/spelling_corrector'
import { attachTag, createDomain, softDelete } from '#tests/functional/search/fixtures'

test.group('Koreksi salah ketik', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => limiter.clear(['memory']))

    test('menampilkan hasil untuk kata yang dikoreksi bila ketikan tidak menemukan apa pun', async ({
        client,
    }) => {
        await createDomain({ title: 'Latoto Resmi', host: 'latoto.com' })

        const response = await search(client).get('/api/v1/search-results?q=latotto')

        response.assertStatus(200)
        response.assertBodyContains({
            data: {
                corrected_query: 'latoto',
                is_fuzzy: false,
                items: [{ host: 'latoto.com' }],
            },
        })
    })

    test('hanya mengganti kata yang salah ketik pada pencarian beberapa kata', async ({
        assert,
    }) => {
        const domain = await createDomain({ title: 'Kopi Nusantara', host: 'kopinusantara.id' })
        await attachTag(domain, 'robusta')

        assert.equal(await new SpellingCorrector().correct('kopi robustaa'), 'kopi robusta')
        assert.equal(await new SpellingCorrector().correct('Kopi Nusantaraa'), 'kopi nusantara')
    })

    test('tidak mengoreksi kata yang benar, kata pendek, atau kata yang tidak mirip apa pun', async ({
        assert,
    }) => {
        await createDomain({ title: 'Kopi Nusantara', host: 'kopinusantara.id' })
        const corrector = new SpellingCorrector()

        assert.isNull(await corrector.correct('kopi nusantara'))
        assert.isNull(await corrector.correct('ko'))
        assert.isNull(await corrector.correct('zzqxv'))
    })

    test('tidak menyarankan kata dari situs yang sudah dihapus', async ({ assert }) => {
        await softDelete(await createDomain({ title: 'Rahasia Lama', host: 'rahasialama.id' }))

        assert.isNull(await new SpellingCorrector().correct('rahasiaa'))
    })

    test('pencarian persis tidak dikoreksi dan memakai situs bernama mirip sebagai jalan terakhir', async ({
        client,
    }) => {
        await createDomain({ title: 'Latoto Resmi', host: 'latoto.com' })

        const response = await search(client).get('/api/v1/search-results?q=latotto&exact=true')

        response.assertStatus(200)
        response.assertBodyContains({
            data: { corrected_query: null, is_fuzzy: true, items: [{ host: 'latoto.com' }] },
        })
    })

    test('pencarian yang sudah benar tidak membawa koreksi', async ({ client }) => {
        await createDomain({ title: 'Latoto Resmi', host: 'latoto.com' })

        const response = await search(client).get('/api/v1/search-results?q=latoto')

        response.assertBodyContains({ data: { corrected_query: null, is_fuzzy: false } })
    })
})
