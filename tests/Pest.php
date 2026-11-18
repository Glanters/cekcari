<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Services\AccountCenter\AccountCenterClient;
use App\Services\AccountCenter\DummyAccountCenterClient;
use App\Services\UrlGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(fn () => Http::preventStrayRequests())
    ->in('Feature');

pest()->extend(TestCase::class)->in('Unit');

function searchUrl(string $path): string
{
    return 'http://'.config('domains.search').'/api/v1/'.$path;
}

function panelUrl(string $path): string
{
    return 'http://'.config('domains.panel').'/api/v1/'.$path;
}

/**
 * Account Center tiruan: email apa pun diterima dengan kata sandi "rahasia".
 */
function fakeAccountCenter(): void
{
    app()->instance(AccountCenterClient::class, new DummyAccountCenterClient('rahasia'));
}

function superadmin(array $attributes = []): User
{
    return User::factory()->create($attributes)->assignRole(Role::findOrCreate(UserRole::Superadmin->value, 'web'));
}

/**
 * Semua host dianggap mengarah ke IP publik agar test tidak bergantung pada DNS sungguhan.
 */
function fakePublicDns(): void
{
    app()->instance(UrlGuard::class, new UrlGuard(fn (string $host): array => ['93.184.216.34']));
}
