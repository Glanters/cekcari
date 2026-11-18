<?php

use App\Enums\CrawlStatus;
use App\Exceptions\RemoteFetchException;
use App\Jobs\CrawlDomainJob;
use App\Models\Domain;
use App\Models\Page;
use App\Services\DomainCrawler;
use App\Services\UrlGuard;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => fakePublicDns());

function htmlResponse(string $body): PromiseInterface
{
    return Http::response($body, 200, ['Content-Type' => 'text/html; charset=utf-8']);
}

it('menelusuri halaman pada host yang sama dan mematuhi robots.txt', function () {
    $domain = Domain::factory()->create(['url' => 'https://tokoku.com', 'host' => 'tokoku.com']);

    Http::fake([
        'tokoku.com/robots.txt' => Http::response("User-agent: *\nDisallow: /admin", 200, ['Content-Type' => 'text/plain']),
        'tokoku.com/produk' => htmlResponse('<title>Produk</title><body>Wajan anti lengket berkualitas <a href="/">Beranda</a></body>'),
        'tokoku.com/admin' => htmlResponse('<title>Admin</title><body>Rahasia</body>'),
        'tokoku.com/' => htmlResponse(
            '<html><head><title>Tokoku</title><meta name="description" content="Toko perabot"></head>'
            .'<body><script>var x = 1;</script>Selamat datang'
            .'<a href="/produk#atas">Produk</a><a href="/admin">Admin</a><a href="https://lain.com/">Luar</a></body></html>'
        ),
    ]);

    $savedCount = app(DomainCrawler::class)->crawl($domain);

    expect($savedCount)->toBe(2)
        ->and(Page::pluck('url')->sort()->values()->all())->toBe(['https://tokoku.com/', 'https://tokoku.com/produk']);

    $homepage = Page::where('url', 'https://tokoku.com/')->first();
    expect($homepage->title)->toBe('Tokoku')
        ->and($homepage->description)->toBe('Toko perabot')
        ->and($homepage->content)->not->toContain('var x');

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'lain.com') || str_contains($request->url(), '/admin'));
});

it('memperbarui data situs dan menandai selesai setelah job berjalan', function () {
    $domain = Domain::factory()->create([
        'url' => 'https://tokoku.com',
        'host' => 'tokoku.com',
        'crawl_status' => CrawlStatus::Pending,
    ]);
    Http::fake([
        'tokoku.com/robots.txt' => Http::response('', 404),
        'tokoku.com/*' => htmlResponse('<title>Tokoku Baru</title><meta name="keywords" content="perabot"><body>Halo</body>'),
    ]);

    app()->call([new CrawlDomainJob($domain->id), 'handle']);

    $domain->refresh();
    expect($domain->crawl_status)->toBe(CrawlStatus::Done)
        ->and($domain->title)->toBe('Tokoku Baru')
        ->and($domain->tags->pluck('name')->all())->toBe(['perabot'])
        ->and($domain->last_crawled_at)->not->toBeNull();
});

it('menandai crawl gagal bila halaman utama tidak dapat dibaca', function () {
    $domain = Domain::factory()->create(['url' => 'https://tokoku.com', 'host' => 'tokoku.com']);
    Http::fake(['tokoku.com/*' => Http::response('Server error', 500)]);

    app()->call([new CrawlDomainJob($domain->id), 'handle']);

    expect($domain->fresh()->crawl_status)->toBe(CrawlStatus::Failed);
});

it('mulai menelusuri dari path yang didaftarkan dan membaca robots.txt dari akar situs', function () {
    $domain = Domain::factory()->create(['url' => 'https://psms.id/players', 'host' => 'psms.id']);
    Http::fake([
        'https://psms.id/robots.txt' => Http::response("User-agent: *\nDisallow: /admin", 200, ['Content-Type' => 'text/plain']),
        'https://psms.id/players' => htmlResponse('<title>Pemain</title><body>Skuad <a href="/players/kiper">Kiper</a></body>'),
        'https://psms.id/players/kiper' => htmlResponse('<title>Kiper</title><body>Penjaga gawang</body>'),
    ]);

    app(DomainCrawler::class)->crawl($domain);

    expect(Page::pluck('url')->sort()->values()->all())->toBe(['https://psms.id/players', 'https://psms.id/players/kiper']);
    Http::assertSent(fn ($request) => $request->url() === 'https://psms.id/robots.txt');
    Http::assertNotSent(fn ($request) => $request->url() === 'https://psms.id/players/robots.txt');
});

it('hanya menelusuri halaman di bawah path yang didaftarkan', function () {
    $domain = Domain::factory()->create(['url' => 'https://dkwl.b-cdn.net/latoto-kl1', 'host' => 'dkwl.b-cdn.net']);
    Http::fake([
        'https://dkwl.b-cdn.net/robots.txt' => Http::response('', 404),
        'https://dkwl.b-cdn.net/latoto-kl1' => htmlResponse(
            '<title>KL1</title><body>'
            .'<a href="/latoto-kl1/promo">Promo</a>'
            .'<a href="/latoto-kl10">Lain</a>'
            .'<a href="/latoto-kl2">Situs lain</a></body>'
        ),
        'https://dkwl.b-cdn.net/latoto-kl1/promo' => htmlResponse('<title>Promo</title><body>Isi promo</body>'),
    ]);

    app(DomainCrawler::class)->crawl($domain);

    expect(Page::pluck('url')->sort()->values()->all())
        ->toBe(['https://dkwl.b-cdn.net/latoto-kl1', 'https://dkwl.b-cdn.net/latoto-kl1/promo']);
    Http::assertNotSent(fn ($request) => in_array($request->url(), [
        'https://dkwl.b-cdn.net/latoto-kl10',
        'https://dkwl.b-cdn.net/latoto-kl2',
    ], true));
});

it('menyimpan halaman yang sama untuk dua entri tanpa saling menimpa', function () {
    $wholeSite = Domain::factory()->create(['url' => 'https://tokoku.com', 'host' => 'tokoku.com']);
    $blogOnly = Domain::factory()->create(['url' => 'https://tokoku.com/blog', 'host' => 'tokoku.com']);
    Http::fake([
        'https://tokoku.com/robots.txt' => Http::response('', 404),
        'https://tokoku.com/' => htmlResponse('<title>Beranda</title><body><a href="/blog">Blog</a></body>'),
        'https://tokoku.com/blog' => htmlResponse('<title>Blog</title><body>Artikel</body>'),
    ]);

    app(DomainCrawler::class)->crawl($wholeSite);
    app(DomainCrawler::class)->crawl($blogOnly);

    expect($wholeSite->pages()->pluck('url')->sort()->values()->all())->toBe(['https://tokoku.com/', 'https://tokoku.com/blog'])
        ->and($blogOnly->pages()->pluck('url')->all())->toBe(['https://tokoku.com/blog']);
});

it('tidak mengikuti redirect ke jaringan internal', function () {
    app()->instance(UrlGuard::class, new UrlGuard(
        fn (string $host): array => $host === 'internal.tokoku.com' ? ['10.0.0.5'] : ['93.184.216.34'],
    ));
    $domain = Domain::factory()->create(['url' => 'https://tokoku.com', 'host' => 'tokoku.com']);
    Http::fake([
        'tokoku.com/robots.txt' => Http::response('', 404),
        'tokoku.com/' => Http::response('', 302, ['Location' => 'https://internal.tokoku.com/']),
    ]);

    expect(fn () => app(DomainCrawler::class)->crawl($domain))->toThrow(RemoteFetchException::class);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'internal.tokoku.com'));
});

it('menandai link yang mengalihkan ke domain lain sebagai dialihkan beserta tujuannya', function () {
    $domain = Domain::factory()->create(['url' => 'https://pengalih.test/promo', 'host' => 'pengalih.test']);
    Http::fake([
        'https://pengalih.test/robots.txt' => Http::response('', 404),
        'https://pengalih.test/promo' => Http::response('', 302, ['Location' => 'https://tujuan-lain.test/']),
        'https://tujuan-lain.test/' => htmlResponse('<title>Situs Tujuan</title><body>Isi</body>'),
    ]);

    app()->call([new CrawlDomainJob($domain->id), 'handle']);

    $domain->refresh();
    expect($domain->crawl_status)->toBe(CrawlStatus::Redirected)
        ->and($domain->redirected_to)->toBe('https://tujuan-lain.test/')
        ->and($domain->pages()->count())->toBe(0);
});

it('menghapus catatan pengalihan setelah link kembali bisa dibaca', function () {
    $domain = Domain::factory()->create([
        'url' => 'https://pulih.test',
        'host' => 'pulih.test',
        'crawl_status' => CrawlStatus::Redirected,
        'redirected_to' => 'https://lama.test/',
    ]);
    Http::fake([
        'https://pulih.test/robots.txt' => Http::response('', 404),
        'https://pulih.test/*' => htmlResponse('<title>Pulih</title><body>Halo</body>'),
    ]);

    app()->call([new CrawlDomainJob($domain->id), 'handle']);

    $domain->refresh();
    expect($domain->crawl_status)->toBe(CrawlStatus::Done)
        ->and($domain->redirected_to)->toBeNull();
});
