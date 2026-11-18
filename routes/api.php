<?php

use App\Http\Controllers\Api\V1\DomainController;
use App\Http\Controllers\Api\V1\DomainCrawlController;
use App\Http\Controllers\Api\V1\DomainPromotionController;
use App\Http\Controllers\Api\V1\IpWhitelistEntryController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\SearchResultController;
use App\Http\Controllers\Api\V1\SearchSuggestionController;
use App\Http\Controllers\Api\V1\SecuritySettingController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\TwoFactorChallengeController;
use App\Http\Controllers\Api\V1\TwoFactorSetupController;
use App\Http\Controllers\Api\V1\UserActivationController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserRoleController;
use App\Http\Controllers\Api\V1\UserTwoFactorController;
use Illuminate\Support\Facades\Route;

// API pencarian publik: hanya di domain pencarian.
Route::domain(config('domains.search'))->prefix('v1')->middleware('throttle:search')->group(function () {
    Route::get('search-results', [SearchResultController::class, 'index']);
    Route::get('search-suggestions', [SearchSuggestionController::class, 'index']);
});

// API pemilik domain: hanya di domain panel, supaya sesi login tidak pernah ada di domain pencarian.
Route::domain(config('domains.panel'))->prefix('v1')->group(function () {
    // Login lewat Account Center, lalu (bila diwajibkan) kode 2FA atau pemasangan 2FA.
    Route::middleware('throttle:auth')->group(function () {
        Route::post('sessions', [SessionController::class, 'store']);
        Route::post('two-factor-challenges', [TwoFactorChallengeController::class, 'store']);
        Route::post('two-factor-setups', [TwoFactorSetupController::class, 'store']);
    });

    Route::middleware(['auth:sanctum', 'active', 'ip-whitelist'])->group(function () {
        Route::delete('sessions', [SessionController::class, 'destroy']);
        Route::get('profile', [ProfileController::class, 'show']);

        Route::get('domains', [DomainController::class, 'index']);
        Route::get('domains/{domain}', [DomainController::class, 'show']);
        Route::delete('domains/{domain}', [DomainController::class, 'destroy']);
        Route::put('domains/{domain}/promotion', [DomainPromotionController::class, 'update']);

        // Menambah atau mengganti link membuat server mengambil data dari situs luar, jadi dibatasi.
        Route::middleware('throttle:remote-fetch')->group(function () {
            Route::post('domains', [DomainController::class, 'store']);
            Route::put('domains/{domain}', [DomainController::class, 'update']);
            Route::post('domains/{domain}/crawls', [DomainCrawlController::class, 'store']);
        });

        // Khusus superadmin; hak akses diperiksa di setiap controller lewat Gate.
        Route::get('users', [UserController::class, 'index']);
        Route::put('users/{user}/activation', [UserActivationController::class, 'update']);
        Route::put('users/{user}/role', [UserRoleController::class, 'update']);
        Route::delete('users/{user}/two-factor', [UserTwoFactorController::class, 'destroy']);
        Route::get('security-settings', [SecuritySettingController::class, 'show']);
        Route::put('security-settings', [SecuritySettingController::class, 'update']);
        Route::get('ip-whitelist-entries', [IpWhitelistEntryController::class, 'index']);
        Route::post('ip-whitelist-entries', [IpWhitelistEntryController::class, 'store']);
        Route::delete('ip-whitelist-entries/{entry}', [IpWhitelistEntryController::class, 'destroy']);
    });
});
