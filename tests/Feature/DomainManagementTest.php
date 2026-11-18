<?php

use App\Enums\CrawlStatus;
use App\Jobs\CrawlDomainJob;
use App\Models\Domain;
use App\Models\User;
use App\Services\UrlGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    fakePublicDns();
    Queue::fake();
    Storage::fake('s3');
});

function pngBytes(): string
{
    ob_start();
    imagepng(imagecreatetruecolor(32, 32));

    return ob_get_clean();
}

function fakeTokokuSite(): void
{
    Http::fake([
        'tokoku.com/logo.png' => Http::response(pngBytes(), 200, ['Content-Type' => 'image/png']),
        'tokoku.com/*' => Http::response(
            '<html><head><title>Tokoku Resmi</title>'
            .'<meta name="description" content="Toko perabot rumah tangga lengkap.">'
            .'<meta name="keywords" content="Dapur, rumah tangga, <script>">'
            .'<link rel="icon" href="/logo.png"></head><body>Selamat datang</body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);
}

it('menambahkan domain hanya dari link dan mengambil datanya otomatis', function () {
    fakeTokokuSite();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson(panelUrl('domains'), ['url' => 'https://Tokoku.com/']);

    $response->assertCreated()
        ->assertJsonPath('data.url', 'https://tokoku.com')
        ->assertJsonPath('data.host', 'tokoku.com')
        ->assertJsonPath('data.title', 'Tokoku Resmi')
        ->assertJsonPath('data.description', 'Toko perabot rumah tangga lengkap.')
        ->assertJsonPath('data.tags', ['dapur', 'rumah tangga'])
        ->assertJsonPath('data.crawl_status', 'pending');

    $domain = Domain::first();
    expect($domain->created_by)->toBe($user->id)
        ->and($domain->logo_path)->toStartWith('logos/')->toEndWith('.png');
    Storage::disk('s3')->assertExists($domain->logo_path);
    Queue::assertPushed(CrawlDomainJob::class, fn (CrawlDomainJob $job) => $job->domainId === $domain->id);
});

it('menerima alamat polos tanpa http dan memakai https', function () {
    Http::fake(['https://psms.com/*' => Http::response('<title>PSMS Medan</title><body>Ayam Kinantan</body>', 200, ['Content-Type' => 'text/html'])]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => '  PSMS.com  '])
        ->assertCreated()
        ->assertJsonPath('data.url', 'https://psms.com')
        ->assertJsonPath('data.title', 'PSMS Medan');
});

it('beralih ke http bila situs tidak bisa dibuka lewat https', function () {
    Http::fake([
        'https://httponly.id/*' => Http::failedConnection(),
        'http://httponly.id/*' => Http::response('<title>Hanya HTTP</title><body>Halo</body>', 200, ['Content-Type' => 'text/html']),
    ]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'httponly.id'])
        ->assertCreated()
        ->assertJsonPath('data.url', 'http://httponly.id')
        ->assertJsonPath('data.title', 'Hanya HTTP');
});

it('menyimpan link lengkap beserta path dan membaca data dari halaman itu', function () {
    Http::fake([
        'https://psms.id/players' => Http::response(
            '<html><head><title>Pemain PSMS Medan</title><meta name="description" content="Daftar pemain musim ini."></head><body>Skuad</body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
        'https://psms.id/favicon.ico' => Http::response('', 404),
    ]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'psms.id/players/'])
        ->assertCreated()
        ->assertJsonPath('data.url', 'https://psms.id/players')
        ->assertJsonPath('data.host', 'psms.id')
        ->assertJsonPath('data.title', 'Pemain PSMS Medan')
        ->assertJsonPath('data.description', 'Daftar pemain musim ini.');

    Http::assertSent(fn ($request) => $request->url() === 'https://psms.id/favicon.ico');
});

it('mengizinkan beberapa link berbeda path pada domain yang sama', function () {
    Domain::factory()->create(['host' => 'dkwl.b-cdn.net', 'url' => 'https://dkwl.b-cdn.net/latoto-kl1']);
    Http::fake([
        'https://dkwl.b-cdn.net/latoto-kl2' => Http::response('<title>Halaman Kedua</title><body>Isi</body>', 200, ['Content-Type' => 'text/html']),
        'https://dkwl.b-cdn.net/favicon.ico' => Http::response('', 404),
    ]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://dkwl.b-cdn.net/latoto-kl2'])
        ->assertCreated()
        ->assertJsonPath('data.url', 'https://dkwl.b-cdn.net/latoto-kl2')
        ->assertJsonPath('data.title', 'Halaman Kedua');

    expect(Domain::where('host', 'dkwl.b-cdn.net')->count())->toBe(2);
});

it('menolak link yang sama walau beda skema, huruf, atau garis miring penutup', function (string $duplicate) {
    $owner = User::factory()->create();
    Domain::factory()->for($owner)->create(['host' => 'psms.id', 'url' => 'https://psms.id/players']);

    $this->actingAs($owner)->postJson(panelUrl('domains'), ['url' => $duplicate])
        ->assertStatus(422)
        ->assertJsonPath('errors.url.0', 'Link ini sudah ada di daftar Anda.');
})->with(['psms.id/players', 'http://psms.id/players', 'https://PSMS.id/players/']);

it('memakai host sebagai judul dan cuplikan isi sebagai deskripsi bila situs tidak menyediakannya', function () {
    Http::fake([
        'polos.id/*' => Http::response('<html><body>Isi halaman sederhana tanpa meta.</body></html>', 200, ['Content-Type' => 'text/html']),
        'polos.id/favicon.ico' => Http::response('', 404),
    ]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://polos.id'])
        ->assertCreated()
        ->assertJsonPath('data.title', 'polos.id')
        ->assertJsonPath('data.description', 'Isi halaman sederhana tanpa meta.')
        ->assertJsonPath('data.logo_url', null);
});

it('tetap menyimpan domain tanpa logo bila ikon situs bukan gambar yang aman', function () {
    Http::fake([
        'tokoku.com/logo.svg' => Http::response('<svg><script>alert(1)</script></svg>', 200, ['Content-Type' => 'image/svg+xml']),
        'tokoku.com/*' => Http::response(
            '<html><head><title>Tokoku</title><link rel="icon" href="/logo.svg"></head><body>Halo</body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://tokoku.com'])
        ->assertCreated()
        ->assertJsonPath('data.logo_url', null);

    expect(Storage::disk('s3')->allFiles())->toBe([]);
});

it('menolak link yang situsnya tidak dapat dibuka', function () {
    Http::fake(['mati.com/*' => Http::response('Not found', 404)]);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://mati.com'])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['url']]);

    expect(Domain::count())->toBe(0);
    Queue::assertNothingPushed();
});

it('menolak link yang mengarah ke jaringan internal', function (string $address) {
    app()->instance(UrlGuard::class, new UrlGuard(fn (): array => [$address]));
    Http::fake();

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://jebakan.com'])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['url']]);

    Http::assertNothingSent();
})->with(['127.0.0.1', '10.1.2.3', '192.168.1.10', '169.254.169.254', '100.64.0.1']);

it('memvalidasi link di server', function () {
    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'ftp://salah'])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['url']]);
});

it('menolak link yang sudah didaftarkan akun lain', function () {
    Domain::factory()->create(['host' => 'tokoku.com', 'url' => 'https://tokoku.com']);

    $this->actingAs(User::factory()->create())->postJson(panelUrl('domains'), ['url' => 'https://tokoku.com'])
        ->assertStatus(422)
        ->assertJsonPath('errors.url.0', 'Link ini sudah didaftarkan oleh akun lain.');
});

it('mengganti link lalu mengambil ulang data situs', function () {
    fakeTokokuSite();
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create(['host' => 'lama.com', 'url' => 'https://lama.com', 'title' => 'Lama']);
    $domain->pages()->create(['url' => 'https://lama.com/', 'http_status' => 200, 'crawled_at' => now()]);

    $this->actingAs($user)->putJson(panelUrl("domains/{$domain->id}"), ['url' => 'https://tokoku.com'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Tokoku Resmi')
        ->assertJsonPath('data.pages_count', 0)
        ->assertJsonPath('data.crawl_status', 'pending');

    Queue::assertPushed(CrawlDomainJob::class);
});

it('hanya menampilkan domain milik sendiri dengan pagination', function () {
    $user = User::factory()->create();
    Domain::factory()->count(3)->for($user)->create();
    Domain::factory()->count(2)->create();

    $this->actingAs($user)->getJson(panelUrl('domains?per_page=2'))
        ->assertOk()
        ->assertJsonCount(2, 'data.items')
        ->assertJsonPath('data.pagination.total', 3)
        ->assertJsonPath('data.pagination.per_page', 2);
});

it('melarang melihat, mengubah, dan menghapus domain milik orang lain', function () {
    $domain = Domain::factory()->create();
    $intruder = User::factory()->create();

    $this->actingAs($intruder)->getJson(panelUrl("domains/{$domain->id}"))->assertForbidden();
    $this->actingAs($intruder)->putJson(panelUrl("domains/{$domain->id}"), ['url' => 'https://lain.com'])->assertForbidden();
    $this->actingAs($intruder)->deleteJson(panelUrl("domains/{$domain->id}"))->assertForbidden();
    $this->actingAs($intruder)->postJson(panelUrl("domains/{$domain->id}/crawls"))->assertForbidden();
});

it('menghapus domain secara lunak', function () {
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create();

    $this->actingAs($user)->deleteJson(panelUrl("domains/{$domain->id}"))->assertOk();

    $this->assertSoftDeleted($domain);
    expect($domain->fresh()->updated_by)->toBe($user->id);
});

it('menjadwalkan pembaruan data bila tidak sedang berjalan', function () {
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create(['crawl_status' => CrawlStatus::Done]);

    $this->actingAs($user)->postJson(panelUrl("domains/{$domain->id}/crawls"))->assertCreated();

    Queue::assertPushed(CrawlDomainJob::class);
});

it('menolak pembaruan data yang masih berjalan', function () {
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create(['crawl_status' => CrawlStatus::Crawling]);

    $this->actingAs($user)->postJson(panelUrl("domains/{$domain->id}/crawls"))->assertStatus(422);

    Queue::assertNothingPushed();
});

it('menandai dan menghentikan promosi link milik sendiri', function () {
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create();

    $this->actingAs($user)->putJson(panelUrl("domains/{$domain->id}/promotion"), ['is_promoted' => true])
        ->assertOk()
        ->assertJsonPath('data.is_promoted', true);

    $this->actingAs($user)->putJson(panelUrl("domains/{$domain->id}/promotion"), ['is_promoted' => false])
        ->assertOk()
        ->assertJsonPath('data.is_promoted', false);

    expect($domain->fresh()->updated_by)->toBe($user->id);
});

it('melarang mempromosikan link milik orang lain', function () {
    $domain = Domain::factory()->create();

    $this->actingAs(User::factory()->create())
        ->putJson(panelUrl("domains/{$domain->id}/promotion"), ['is_promoted' => true])
        ->assertForbidden();

    expect($domain->fresh()->is_promoted)->toBeFalse();
});

it('memvalidasi status promosi', function () {
    $user = User::factory()->create();
    $domain = Domain::factory()->for($user)->create();

    $this->actingAs($user)->putJson(panelUrl("domains/{$domain->id}/promotion"), ['is_promoted' => 'mungkin'])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['is_promoted']]);
});

it('mencari link milik sendiri berdasarkan judul atau alamat', function () {
    $user = User::factory()->create();
    Domain::factory()->for($user)->create(['title' => 'Toko Kopi', 'url' => 'https://kopi.test', 'host' => 'kopi.test']);
    Domain::factory()->for($user)->create(['title' => 'Situs Lain', 'url' => 'https://dkwl.b-cdn.net/latoto-kl1', 'host' => 'dkwl.b-cdn.net']);
    Domain::factory()->for($user)->create(['title' => 'Berita', 'url' => 'https://berita.test', 'host' => 'berita.test']);
    Domain::factory()->create(['title' => 'Kopi Orang Lain', 'url' => 'https://kopi-lain.test', 'host' => 'kopi-lain.test']);

    $this->actingAs($user)->getJson(panelUrl('domains?q=kopi'))
        ->assertOk()
        ->assertJsonPath('data.pagination.total', 1)
        ->assertJsonPath('data.items.0.title', 'Toko Kopi');

    $this->actingAs($user)->getJson(panelUrl('domains?q=latoto-kl1'))
        ->assertOk()
        ->assertJsonPath('data.pagination.total', 1)
        ->assertJsonPath('data.items.0.url', 'https://dkwl.b-cdn.net/latoto-kl1');
});

it('memperlakukan karakter wildcard di pencarian link sebagai teks biasa', function () {
    $user = User::factory()->create();
    Domain::factory()->for($user)->create(['title' => 'Toko Kopi']);

    $this->actingAs($user)->getJson(panelUrl('domains?q=%25'))
        ->assertOk()
        ->assertJsonPath('data.pagination.total', 0);
});
