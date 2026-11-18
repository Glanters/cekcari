<?php

beforeEach(function () {
    $this->withoutVite();
    config(['seo.search_url' => 'https://cekcari.com', 'seo.google_site_verification' => null]);
});

function searchPage(string $path): string
{
    return 'http://'.config('domains.search').$path;
}

function panelPage(string $path): string
{
    return 'http://'.config('domains.panel').$path;
}

it('memberi beranda judul, deskripsi, canonical, open graph, dan data terstruktur', function () {
    $response = $this->get(searchPage('/'))->assertOk();

    $response->assertSee('<title>CekCari — Mesin Pencari Situs dan Halaman Web Indonesia</title>', false)
        ->assertSee('<meta name="description" content="Cari situs dan halaman web Indonesia', false)
        ->assertSee('<meta name="robots" content="index, follow">', false)
        ->assertSee('<link rel="canonical" href="https://cekcari.com/">', false)
        ->assertSee('<meta property="og:image" content="https://cekcari.com/images/brand/cekcari-logo-512.png">', false)
        ->assertSee('application/ld+json', false)
        ->assertSee('"@type":"WebSite","name":"CekCari","url":"https://cekcari.com/"', false)
        ->assertSee('<html lang="id">', false);
});

it('tidak mengindeks halaman hasil pencarian tetapi tetap mengikuti tautannya', function () {
    $this->get(searchPage('/cari?q=kopi'))
        ->assertOk()
        ->assertSee('<title>kopi — Hasil pencarian CekCari</title>', false)
        ->assertSee('<meta name="robots" content="noindex, follow">', false)
        ->assertDontSee('rel="canonical"', false)
        ->assertDontSee('application/ld+json', false);
});

it('mengamankan kata kunci di judul halaman hasil', function () {
    $this->get(searchPage('/cari?q=%3Cscript%3Ealert(1)%3C/script%3E'))
        ->assertOk()
        ->assertDontSee('<script>alert(1)</script>', false)
        ->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false);
});

it('menjawab 404 sungguhan untuk halaman yang tidak ada di domain pencarian', function () {
    $this->get(searchPage('/halaman-acak'))
        ->assertNotFound()
        ->assertSee('<meta name="robots" content="noindex, follow">', false);
});

it('menyediakan robots.txt dan sitemap.xml untuk domain pencarian', function () {
    $this->get(searchPage('/robots.txt'))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
        ->assertSee("Disallow: /api/\n", false)
        ->assertSee('Sitemap: https://cekcari.com/sitemap.xml', false);

    $this->get(searchPage('/sitemap.xml'))
        ->assertOk()
        ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
        ->assertSee('<loc>https://cekcari.com/</loc>', false)
        ->assertDontSee('/cari', false);
});

it('menutup seluruh domain panel dari mesin pencari', function () {
    $this->get(panelPage('/robots.txt'))
        ->assertOk()
        ->assertSee("User-agent: *\nDisallow: /", false);

    $this->get(panelPage('/masuk'))
        ->assertOk()
        ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
        ->assertSee('<meta name="robots" content="noindex, nofollow">', false)
        ->assertDontSee('application/ld+json', false);
});

it('menampilkan tag verifikasi Google Search Console bila diisi', function () {
    config(['seo.google_site_verification' => 'kode-verifikasi-uji']);

    $this->get(searchPage('/'))
        ->assertSee('<meta name="google-site-verification" content="kode-verifikasi-uji">', false);
});

it('menjadikan domain pencarian bisa dipasang sebagai aplikasi, tetapi tidak panel', function () {
    $this->get(searchPage('/'))
        ->assertOk()
        ->assertSee('<link rel="manifest" href="/manifest.webmanifest">', false)
        ->assertSee('<meta name="apple-mobile-web-app-capable" content="yes">', false)
        ->assertSee('<meta name="apple-mobile-web-app-title" content="CekCari">', false);

    $this->get(panelPage('/login'))
        ->assertOk()
        ->assertDontSee('rel="manifest"', false)
        ->assertDontSee('apple-mobile-web-app-capable', false);
});

it('menyediakan manifest dan ikon PWA yang lengkap', function () {
    $manifest = json_decode(file_get_contents(public_path('manifest.webmanifest')), true, flags: JSON_THROW_ON_ERROR);

    expect($manifest)
        ->name->not->toBeEmpty()
        ->short_name->toBe('CekCari')
        ->start_url->toBe('/')
        ->display->toBe('standalone');

    $purposes = collect($manifest['icons'])->groupBy('purpose');
    expect($purposes->get('any')->pluck('sizes')->all())->toContain('192x192', '512x512')
        ->and($purposes->get('maskable')->pluck('sizes')->all())->toContain('192x192', '512x512');

    foreach ($manifest['icons'] as $icon) {
        expect(public_path(ltrim($icon['src'], '/')))->toBeFile();
    }

    expect(public_path('sw.js'))->toBeFile();
});

it('mengirim header keamanan dasar di semua domain', function () {
    foreach ([searchPage('/'), panelPage('/masuk'), searchUrl('search-results?q=kopi')] as $url) {
        $this->get($url)
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
});
