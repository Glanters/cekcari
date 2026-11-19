import { test } from '@japa/runner'
import HtmlExtractor from '#services/HtmlExtractor'
import UrlResolver from '#services/UrlResolver'

test.group('HtmlExtractor', () => {
    test('membaca judul, deskripsi, kata kunci, ikon, teks, dan tautan', ({ assert }) => {
        const extracted = new HtmlExtractor(new UrlResolver()).extract(
            '<html><head><title> Tokoku\n Resmi </title><meta name="Description" content="Toko perabot.">' +
                '<meta name="keywords" content="Dapur, rumah tangga, dapur, ">' +
                '<link rel="Shortcut Icon" href="/favicon.png"><link rel="apple-touch-icon" href="/apple.png"></head>' +
                '<body><script>var x = 1;</script><p>Selamat   datang</p><a href="/produk#atas">Produk</a>' +
                '<a href="/iklan" rel="nofollow sponsored">Iklan</a><a href="mailto:a@b.c">Surat</a><a href="/produk">Lagi</a></body></html>',
            'https://tokoku.com/kategori/'
        )

        assert.equal(extracted.title, 'Tokoku Resmi')
        assert.equal(extracted.description, 'Toko perabot.')
        assert.deepEqual(extracted.keywords, ['dapur', 'rumah tangga'])
        assert.deepEqual(extracted.icons, {
            faviconUrl: 'https://tokoku.com/favicon.png',
            touchIconUrl: 'https://tokoku.com/apple.png',
        })
        assert.equal(extracted.text, 'Selamat datangProdukIklanSuratLagi')
        assert.deepEqual(extracted.links, ['https://tokoku.com/produk'])
    })

    test('memakai og:title bila tag title kosong', ({ assert }) => {
        const extracted = new HtmlExtractor(new UrlResolver()).extract(
            '<title> </title><meta property="og:title" content="Judul OG"><body>Isi</body>',
            'https://tokoku.com/'
        )

        assert.equal(extracted.title, 'Judul OG')
        assert.isNull(extracted.description)
        assert.deepEqual(extracted.icons, { faviconUrl: null, touchIconUrl: null })
    })
})
