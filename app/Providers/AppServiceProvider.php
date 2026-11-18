<?php

namespace App\Providers;

use App\Models\User;
use App\Services\AccountCenter\AccountCenterClient;
use App\Services\AccountCenter\DummyAccountCenterClient;
use App\Services\AccountCenter\HttpAccountCenterClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AccountCenterClient::class, function (Application $app) {
            // Dummy hanya untuk masa uji. Di production login selalu lewat Account Center sungguhan,
            // walaupun ACCOUNTCENTER_DRIVER=dummy terlanjur terisi.
            if (config('services.accountcenter.driver') === 'dummy' && ! $app->isProduction()) {
                return new DummyAccountCenterClient((string) config('services.accountcenter.dummy_password'));
            }

            return new HttpAccountCenterClient;
        });
    }

    public function boot(): void
    {
        $trustedProxies = array_filter(array_map('trim', explode(',', (string) config('security.trusted_proxies'))));

        if ($trustedProxies !== []) {
            TrustProxies::at($trustedProxies);
        }

        Gate::define('manage-users', fn (User $user) => $user->isSuperadmin());
        Gate::define('manage-security', fn (User $user) => $user->isSuperadmin());

        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));

        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Endpoint ini membuat server mengakses situs luar; dibatasi agar tidak dipakai membanjiri situs lain.
        // 30/menit cukup untuk menambahkan satu daftar berisi maksimal 20 situs sekaligus.
        RateLimiter::for('remote-fetch', fn (Request $request) => Limit::perMinute(30)->by($request->user()?->id ?: $request->ip()));
    }
}
