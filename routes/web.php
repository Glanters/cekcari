<?php

use App\Http\Controllers\CrawlerFileController;
use App\Http\Controllers\SpaPageController;
use Illuminate\Support\Facades\Route;

// Domain pencarian (mis. cekcari.com): hanya halaman yang benar-benar ada yang dijawab 200,
// selebihnya 404, agar mesin pencari tidak mengindeks halaman kosong.
Route::domain(config('domains.search'))->group(function () {
    Route::get('robots.txt', [CrawlerFileController::class, 'searchRobots']);
    Route::get('sitemap.xml', [CrawlerFileController::class, 'searchSitemap']);
    Route::get('/', [SpaPageController::class, 'searchHome']);
    Route::get('cari', [SpaPageController::class, 'searchResults']);
    Route::get('{path}', [SpaPageController::class, 'searchNotFound'])->where('path', '^(?!api/|sanctum/|up$|build/).*$');
});

// Domain panel: semua halaman ditangani Vue Router, dan seluruhnya tertutup untuk mesin pencari.
Route::domain(config('domains.panel'))->group(function () {
    Route::get('robots.txt', [CrawlerFileController::class, 'panelRobots']);
    Route::get('{path?}', [SpaPageController::class, 'panel'])->where('path', '^(?!api/|sanctum/|up$|build/).*$');
});
