import { test } from '@japa/runner'
import UrlResolver from '#services/url_resolver'

test.group('UrlResolver', () => {
    test('mengubah tautan relatif {href} menjadi url absolut')
        .with([
            { href: '/produk', expected: 'https://tokoku.com/produk' },
            {
                href: 'wajan?warna=merah',
                expected: 'https://tokoku.com/kategori/wajan?warna=merah',
            },
            { href: '../tentang', expected: 'https://tokoku.com/tentang' },
            { href: '?halaman=2', expected: 'https://tokoku.com/kategori/dapur?halaman=2' },
            { href: '//cdn.tokoku.com/a', expected: 'https://cdn.tokoku.com/a' },
            { href: 'https://lain.com:443/x#bagian', expected: 'https://lain.com/x' },
            { href: '#atas', expected: null },
            { href: 'mailto:a@b.c', expected: null },
            { href: 'javascript:void(0)', expected: null },
        ])
        .run(({ assert }, { href, expected }) => {
            assert.strictEqual(
                new UrlResolver().resolve('https://Tokoku.com/kategori/dapur', href),
                expected
            )
        })
})
