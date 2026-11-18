import { test } from '@japa/runner'
import {
    brandOf,
    variantDescription,
    variantTags,
    variantTitle,
} from '#support/result_text_variants'

const TAGS = ['login depobos', 'daftar depobos', 'situs official depobos']

const mirror = (host: string) => ({
    url: `https://${host}`,
    title: 'DEPOBOS LINK GAME ONLINE TERPERCAYA',
    description:
        'DEPOBOS adalah Bandar Togel, Live Casino, Slot & Bola Online Terlengkap. Dalam dunia judi online yang penuh persaingan, satu nama terus mencuat.',
    tags: TAGS,
})

const VARIANTS = Array.from({ length: 20 }, (_, index) => index + 1)

test.group('Variasi teks hasil untuk situs mirror', () => {
    test('nama merek diambil dari kata judul yang juga ada di alamat: {expected}')
        .with([
            { source: mirror('depobos45.com'), expected: 'DEPOBOS' },
            {
                source: { url: 'https://dkwl.b-cdn.net/indrabet-kl1', title: 'indrabet-kl1' },
                expected: 'indrabet',
            },
            {
                source: { url: 'https://www.kopi99.id', title: 'Selamat datang' },
                expected: 'Kopi',
            },
        ])
        .run(({ assert }, { source, expected }) => {
            assert.equal(brandOf(source), expected)
        })

    test('20 mirror pertama mendapat 20 pola judul berbeda yang memuat alamatnya', ({ assert }) => {
        // Alamat disamakan agar yang dibandingkan benar-benar polanya.
        const titles = VARIANTS.map((variant) => variantTitle(mirror('depobos45.com'), variant))

        assert.lengthOf(new Set(titles), VARIANTS.length)
        titles.forEach((title) => assert.include(title, 'depobos45.com'))
        assert.equal(titles[0], 'DEPOBOS — Link Alternatif depobos45.com')
        // Pola dari tag situs: "login depobos" ditulis dengan nama merek seperti di judul.
        assert.include(titles, 'Login DEPOBOS di depobos45.com')
    })

    test('20 mirror pertama mendapat 20 susunan deskripsi berbeda', ({ assert }) => {
        const descriptions = VARIANTS.map((variant) =>
            variantDescription(mirror('depobos45.com'), variant)
        )

        assert.lengthOf(new Set(descriptions), VARIANTS.length)
        descriptions.forEach((description) => assert.include(description, 'depobos45.com'))
    })

    test('deskripsi hanya dirangkai dari alamat, kalimat asli, dan tag situs', ({ assert }) => {
        assert.equal(
            variantDescription(mirror('depobos45.com'), 1),
            'Dalam dunia judi online yang penuh persaingan, satu nama terus mencuat. Link alternatif DEPOBOS di depobos45.com.'
        )
        assert.equal(
            variantDescription({ ...mirror('depobos45.com'), tags: [] }, 4),
            'Alamat DEPOBOS lainnya: depobos45.com. DEPOBOS adalah Bandar Togel, Live Casino, Slot & Bola Online Terlengkap.'
        )
    })

    test('urutan tag digeser dan tidak pernah sama dengan urutan asli', ({ assert }) => {
        for (const variant of VARIANTS) {
            const tags = variantTags(TAGS, variant)

            assert.sameMembers(tags, TAGS)
            assert.notDeepEqual(tags, TAGS)
        }

        assert.deepEqual(variantTags(['satu'], 3), ['satu'])
    })
})
