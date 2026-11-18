<?php

use App\Models\User;

it('tidak menyediakan api pemilik domain di domain pencarian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson(searchUrl('domains'))->assertNotFound();
    $this->postJson(searchUrl('sessions'), ['email' => $user->email, 'password' => 'password'])->assertNotFound();
});

it('tidak menyediakan api pencarian di domain panel', function () {
    $this->getJson(panelUrl('search-results?q=kopi'))->assertNotFound();
});

it('mengirim kerangka spa yang berbeda untuk tiap domain', function () {
    $this->withoutVite();

    $this->get('http://'.config('domains.search').'/cari')
        ->assertOk()
        ->assertViewHas('entry', 'resources/js/search.js');

    $this->get('http://'.config('domains.panel').'/masuk')
        ->assertOk()
        ->assertViewHas('entry', 'resources/js/panel.js');
});

it('menjawab 404 untuk berkas build yang sudah tidak ada', function () {
    $this->get('http://'.config('domains.panel').'/build/assets/DashboardLayout-lama.js')->assertNotFound();
});

it('menolak host yang tidak dikenal', function () {
    $this->get('http://domain-lain.test/')->assertNotFound();
});
