import { test } from '@japa/runner'
import { brandOf, variantDescription, variantTitle } from '#support/result_text_variants'

const DEPOBOS = {
    url: 'https://depobos45.com',
    title: 'DEPOBOS LINK GAME ONLINE TERPERCAYA',
    description:
        'DEPOBOS adalah Bandar Togel, Live Casino, Slot & Bola Online Terlengkap. Dalam dunia judi online yang penuh persaingan, satu nama terus mencuat.',
}

test.group('Variasi teks hasil untuk situs mirror', () => {
    test('nama merek diambil dari kata judul yang juga ada di alamat: {expected}')
        .with([
            { source: DEPOBOS, expected: 'DEPOBOS' },
            {
                source: {
                    url: 'https://dkwl.b-cdn.net/indrabet-kl1',
                    title: 'indrabet-kl1',
                    description: '',
                },
                expected: 'indrabet',
            },
            {
                source: { url: 'https://www.kopi99.id', title: 'Selamat datang', description: '' },
                expected: 'Kopi',
            },
        ])
        .run(({ assert }, { source, expected }) => {
            assert.equal(brandOf(source), expected)
        })

    test('setiap urutan variasi menghasilkan judul berbeda yang memuat alamat link', ({
        assert,
    }) => {
        const titles = [1, 2, 3, 4, 5].map((variant) => variantTitle(DEPOBOS, variant))

        assert.lengthOf(new Set(titles), 5)
        titles.forEach((title) => assert.include(title, 'depobos45.com'))
        assert.equal(titles[0], 'DEPOBOS — Link Alternatif depobos45.com')
    })

    test('deskripsi variasi memuat alamat dan satu kalimat deskripsi asli secara bergiliran', ({
        assert,
    }) => {
        assert.equal(
            variantDescription(DEPOBOS, 1),
            'Link alternatif DEPOBOS di depobos45.com. DEPOBOS adalah Bandar Togel, Live Casino, Slot & Bola Online Terlengkap.'
        )
        assert.equal(
            variantDescription(DEPOBOS, 2),
            'depobos45.com adalah salah satu alamat DEPOBOS. Dalam dunia judi online yang penuh persaingan, satu nama terus mencuat.'
        )
    })
})
