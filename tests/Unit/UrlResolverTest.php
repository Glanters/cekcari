<?php

use App\Services\UrlResolver;

it('mengubah tautan relatif menjadi url absolut', function (string $href, ?string $expected) {
    expect((new UrlResolver)->resolve('https://Tokoku.com/kategori/dapur', $href))->toBe($expected);
})->with([
    ['/produk', 'https://tokoku.com/produk'],
    ['wajan?warna=merah', 'https://tokoku.com/kategori/wajan?warna=merah'],
    ['../tentang', 'https://tokoku.com/tentang'],
    ['?halaman=2', 'https://tokoku.com/kategori/dapur?halaman=2'],
    ['//cdn.tokoku.com/a', 'https://cdn.tokoku.com/a'],
    ['https://lain.com:443/x#bagian', 'https://lain.com/x'],
    ['#atas', null],
    ['mailto:a@b.c', null],
    ['javascript:void(0)', null],
]);
