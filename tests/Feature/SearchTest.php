<?php

use App\Models\Domain;
use App\Models\Tag;
use App\Services\SearchService;

it('menampilkan domain yang terdaftar dan menyembunyikan yang sudah dihapus', function () {
    Domain::factory()->create(['title' => 'Kopi Nusantara', 'host' => 'kopinusantara.id']);
    Domain::factory()->create(['title' => 'Kopi Lama', 'host' => 'kopilama.id'])->delete();

    $this->getJson(searchUrl('search-results?q=kopi'))
        ->assertOk()
        ->assertJsonPath('data.pagination.total', 1)
        ->assertJsonPath('data.items.0.host', 'kopinusantara.id')
        ->assertJsonPath('data.is_fuzzy', false);
});

it('menemukan domain dari isi halaman hasil crawl beserta cuplikan bersorot', function () {
    $domain = Domain::factory()->create(['title' => 'Tokoku', 'description' => 'Toko perabot rumah tangga lengkap']);
    $domain->pages()->create([
        'url' => 'https://tokoku.com/wajan',
        'title' => 'Wajan',
        'content' => 'Wajan anti lengket dengan lapisan keramik untuk memasak sehari-hari.',
        'http_status' => 200,
        'crawled_at' => now(),
    ]);

    $response = $this->getJson(searchUrl('search-results?q=keramik'))->assertOk();

    $response->assertJsonPath('data.items.0.id', $domain->id)
        ->assertJsonPath('data.items.0.related_pages.0.url', 'https://tokoku.com/wajan');

    expect($response->json('data.items.0.related_pages.0.snippet'))
        ->toContain(SearchService::HIGHLIGHT_START.'keramik'.SearchService::HIGHLIGHT_END);
});

it('tidak mengulang halaman utama sebagai halaman terkait dan mengirim deskripsi utuh', function () {
    $description = 'Situs ini berisi panduan lengkap memasak rendang untuk pemula di rumah.';
    $domain = Domain::factory()->create(['url' => 'https://resep.id', 'host' => 'resep.id', 'description' => $description]);
    $domain->pages()->create(['url' => 'https://resep.id/', 'title' => 'Beranda', 'content' => 'Panduan rendang', 'http_status' => 200, 'crawled_at' => now()]);
    $domain->pages()->create(['url' => 'https://resep.id/rendang', 'title' => 'Rendang', 'content' => 'Resep rendang padang', 'http_status' => 200, 'crawled_at' => now()]);

    $response = $this->getJson(searchUrl('search-results?q=rendang'))->assertOk();

    expect($response->json('data.items.0.related_pages'))->toHaveCount(1)
        ->and($response->json('data.items.0.related_pages.0.url'))->toBe('https://resep.id/rendang')
        ->and(str_replace([SearchService::HIGHLIGHT_START, SearchService::HIGHLIGHT_END], '', $response->json('data.items.0.description')))
        ->toBe($description);
});

it('menemukan domain dari tag', function () {
    $domain = Domain::factory()->create(['title' => 'Situs A', 'description' => 'Deskripsi umum situs tanpa kata kunci']);
    $domain->tags()->attach(Tag::create(['name' => 'kuliner', 'slug' => 'kuliner']));

    $this->getJson(searchUrl('search-results?q=kuliner'))
        ->assertOk()
        ->assertJsonPath('data.items.0.id', $domain->id);
});

it('memberi hasil mirip bila kata kunci salah ketik', function () {
    $domain = Domain::factory()->create(['title' => 'Tokopedia', 'host' => 'tokopedia.com']);

    $this->getJson(searchUrl('search-results?q=tokopedya'))
        ->assertOk()
        ->assertJsonPath('data.is_fuzzy', true)
        ->assertJsonPath('data.items.0.id', $domain->id);
});

it('memvalidasi kata kunci pencarian', function () {
    $this->getJson(searchUrl('search-results'))
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['q']]);
});

it('memberikan saran pencarian dari judul domain yang masih terdaftar', function () {
    Domain::factory()->create(['title' => 'Kopi Nusantara']);
    Domain::factory()->create(['title' => 'Kopi Rahasia'])->delete();

    $this->getJson(searchUrl('search-suggestions?q=kop'))
        ->assertOk()
        ->assertJsonPath('data.items', ['Kopi Nusantara']);
});

it('mengamankan karakter wildcard pada saran pencarian', function () {
    Domain::factory()->create(['title' => 'Kopi Nusantara']);

    $this->getJson(searchUrl('search-suggestions?q=%25%25'))
        ->assertOk()
        ->assertJsonPath('data.items', []);
});

it('menaruh satu link promosi yang cocok di slot teratas dan tidak mengulangnya di daftar', function () {
    $promotedDomain = Domain::factory()->create(['title' => 'Kopi Promo', 'is_promoted' => true]);
    Domain::factory()->count(3)->create(['title' => 'Kopi Biasa']);
    Domain::factory()->create(['title' => 'Teh Promo', 'is_promoted' => true]);

    $response = $this->getJson(searchUrl('search-results?q=kopi&seed=12345'))->assertOk();

    expect($response->json('data.promoted.id'))->toBe($promotedDomain->id)
        ->and(collect($response->json('data.items'))->pluck('id'))->not->toContain($promotedDomain->id)
        ->and($response->json('data.pagination.total'))->toBe(3);
});

it('tidak menampilkan slot promosi bila tidak ada link promosi yang cocok', function () {
    Domain::factory()->create(['title' => 'Kopi Biasa']);
    Domain::factory()->create(['title' => 'Teh Promo', 'is_promoted' => true]);

    $this->getJson(searchUrl('search-results?q=kopi'))
        ->assertOk()
        ->assertJsonPath('data.promoted', null);
});

it('memilih link promosi secara acak di antara yang cocok', function () {
    $promotedIds = Domain::factory()->count(5)->create(['title' => 'Kopi Promo', 'is_promoted' => true])->pluck('id');

    $pickedIds = collect(range(1, 40))
        ->map(fn (int $seed) => $this->getJson(searchUrl("search-results?q=kopi&seed={$seed}"))->json('data.promoted.id'))
        ->unique();

    expect($pickedIds->count())->toBeGreaterThan(1)
        ->and($promotedIds->intersect($pickedIds)->count())->toBe($pickedIds->count());
});

it('mengacak urutan per seed tetapi konsisten antarhalaman untuk seed yang sama', function () {
    $allIds = Domain::factory()->count(12)->create(['title' => 'Kopi Rolling'])->pluck('id')->sort()->values();

    $orderFor = function (int $seed): array {
        $firstPage = $this->getJson(searchUrl("search-results?q=kopi&seed={$seed}&per_page=5&page=1"))->json('data.items');
        $secondPage = $this->getJson(searchUrl("search-results?q=kopi&seed={$seed}&per_page=5&page=2"))->json('data.items');
        $thirdPage = $this->getJson(searchUrl("search-results?q=kopi&seed={$seed}&per_page=5&page=3"))->json('data.items');

        return collect([...$firstPage, ...$secondPage, ...$thirdPage])->pluck('id')->all();
    };

    $firstVisitor = $orderFor(111);

    expect(collect($firstVisitor)->sort()->values()->all())->toBe($allIds->all())
        ->and($orderFor(111))->toBe($firstVisitor)
        ->and($orderFor(222))->not->toBe($firstVisitor);
});

it('memvalidasi seed urutan', function () {
    $this->getJson(searchUrl('search-results?q=kopi&seed=abc'))
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['seed']]);
});
