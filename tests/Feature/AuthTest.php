<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Services\AccountCenter\AccountCenterClient;
use App\Services\AccountCenter\AccountCenterResult;
use App\Support\TwoFactorPolicy;
use Illuminate\Support\Facades\DB;
use PragmaRX\Google2FA\Google2FA;

beforeEach(function () {
    // Sanctum hanya memakai sesi untuk permintaan dari domain SPA yang terdaftar.
    $this->withHeader('Origin', 'http://'.config('domains.panel'));
    fakeAccountCenter();
});

function requireTwoFactor(bool $isRequired = true): void
{
    TwoFactorPolicy::setRequired($isRequired, superadmin());
}

function login(string $email, string $password = 'rahasia')
{
    return test()->postJson(panelUrl('sessions'), ['email' => $email, 'password' => $password]);
}

function currentOtp(string $secret): string
{
    return (new Google2FA)->getCurrentOtp($secret);
}

it('membuat akun menunggu aktivasi saat login pertama dan belum mengizinkan masuk', function () {
    login('baru@contoh.id')
        ->assertForbidden()
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Akun Anda belum diaktifkan. Minta superadmin CekCari mengaktifkan akun ini, lalu masuk lagi.');

    $this->assertGuest('web');

    $user = User::query()->whereEmail('baru@contoh.id')->firstOrFail();
    expect($user->isActive())->toBeFalse()
        ->and($user->role())->toBe(UserRole::Member)
        ->and($user->name)->toBe('Baru');
});

it('menjadikan email superadmin awal langsung aktif sebagai superadmin', function () {
    config(['services.accountcenter.superadmin_emails' => 'lain@contoh.id, Bos@Contoh.id']);

    login('bos@contoh.id')
        ->assertOk()
        ->assertJsonPath('data.status', 'authenticated')
        ->assertJsonPath('data.user.role', 'superadmin');

    $this->assertAuthenticated('web');
});

it('langsung masuk bila akun aktif dan 2FA sedang dimatikan', function () {
    $user = User::factory()->create(['email' => 'rina@contoh.id']);

    login('RINA@contoh.id')
        ->assertOk()
        ->assertJsonPath('data.status', 'authenticated')
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.role', 'member');

    $this->assertAuthenticatedAs($user, 'web');
    expect($user->fresh()->last_login_at)->not->toBeNull();
});

it('menolak kata sandi Account Center yang salah', function () {
    User::factory()->create(['email' => 'rina@contoh.id']);

    login('rina@contoh.id', 'salah')
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['email']]);

    $this->assertGuest('web');
});

it('memberi tahu bila Account Center tidak dapat dihubungi', function () {
    app()->instance(AccountCenterClient::class, new class implements AccountCenterClient
    {
        public function authenticate(string $email, string $password): AccountCenterResult
        {
            return AccountCenterResult::unavailable();
        }
    });

    login('rina@contoh.id')->assertStatus(503)->assertJsonPath('success', false);
});

it('meminta pemasangan 2FA lalu masuk setelah kode pertama benar', function () {
    requireTwoFactor();
    $user = User::factory()->create(['email' => 'rina@contoh.id']);

    $response = login('rina@contoh.id')
        ->assertOk()
        ->assertJsonPath('data.status', 'two_factor_setup');

    $secret = $response->json('data.two_factor_setup.secret');
    expect($response->json('data.two_factor_setup.qr_code'))->toStartWith('data:image/svg+xml;base64,');
    $this->assertGuest('web');

    $this->postJson(panelUrl('two-factor-setups'), ['code' => '000000'])->assertStatus(422);

    $confirmed = $this->postJson(panelUrl('two-factor-setups'), ['code' => currentOtp($secret)])
        ->assertOk()
        ->assertJsonPath('data.status', 'authenticated')
        ->assertJsonPath('data.user.has_two_factor', true)
        ->assertJsonCount(8, 'data.recovery_codes');

    $this->assertAuthenticatedAs($user, 'web');

    // Kunci 2FA disimpan terenkripsi dan recovery code disimpan dalam bentuk hash.
    $stored = DB::table('users')->where('id', $user->id)->first();
    expect($stored->two_factor_secret)->not->toContain($secret)
        ->and($stored->two_factor_recovery_codes)->not->toContain($confirmed->json('data.recovery_codes.0'));
});

it('meminta kode 2FA dan tidak menerima kode yang sama dua kali', function () {
    requireTwoFactor();
    $secret = (new Google2FA)->generateSecretKey(32);
    User::factory()->create([
        'email' => 'rina@contoh.id',
    ])->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()])->save();

    login('rina@contoh.id')->assertOk()->assertJsonPath('data.status', 'two_factor_challenge');
    $this->assertGuest('web');

    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(422);

    $code = currentOtp($secret);
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => $code])
        ->assertOk()
        ->assertJsonPath('data.status', 'authenticated');
    $this->assertAuthenticated('web');

    $this->deleteJson(panelUrl('sessions'))->assertOk();

    login('rina@contoh.id')->assertJsonPath('data.status', 'two_factor_challenge');
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => $code])->assertStatus(422);
});

it('menerima recovery code sekali saja', function () {
    requireTwoFactor();
    $user = User::factory()->create(['email' => 'rina@contoh.id']);
    $user->forceFill([
        'two_factor_secret' => (new Google2FA)->generateSecretKey(32),
        'two_factor_recovery_codes' => [bcrypt('abcde-12345')],
        'two_factor_confirmed_at' => now(),
    ])->save();

    login('rina@contoh.id');
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => 'ABCDE-12345'])->assertOk();

    $this->deleteJson(panelUrl('sessions'))->assertOk();

    login('rina@contoh.id');
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => 'abcde-12345'])->assertStatus(422);
});

it('membatalkan login setelah lima kode salah', function () {
    requireTwoFactor();
    User::factory()->create(['email' => 'rina@contoh.id'])
        ->forceFill(['two_factor_secret' => (new Google2FA)->generateSecretKey(32), 'two_factor_confirmed_at' => now()])
        ->save();

    login('rina@contoh.id');

    foreach (range(1, 4) as $attempt) {
        $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(422);
    }

    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(410);
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(410);
});

it('menolak kode 2FA tanpa langkah login sebelumnya', function () {
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '123456'])->assertStatus(410);
    $this->postJson(panelUrl('two-factor-setups'), ['code' => '123456'])->assertStatus(410);
});

it('memutus sesi akun yang dinonaktifkan', function () {
    $user = User::factory()->create(['activated_at' => null]);

    $this->actingAs($user)->getJson(panelUrl('profile'))
        ->assertForbidden()
        ->assertJsonPath('success', false);

    $this->assertGuest('web');
});

it('mengembalikan 401 untuk profil tanpa login', function () {
    $this->getJson(panelUrl('profile'))
        ->assertUnauthorized()
        ->assertJsonPath('success', false);
});

it('keluar dari sesi', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->deleteJson(panelUrl('sessions'))->assertOk();

    $this->assertGuest('web');
});

it('mengunci 2FA akun setelah lima kode salah walaupun login diulang', function () {
    requireTwoFactor();
    User::factory()->create(['email' => 'rina@contoh.id'])
        ->forceFill(['two_factor_secret' => (new Google2FA)->generateSecretKey(32), 'two_factor_confirmed_at' => now()])
        ->save();

    login('rina@contoh.id');
    foreach (range(1, 3) as $attempt) {
        $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(422);
    }

    login('rina@contoh.id')->assertJsonPath('data.status', 'two_factor_challenge');
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(422);
    $this->postJson(panelUrl('two-factor-challenges'), ['code' => '000000'])->assertStatus(422);

    login('rina@contoh.id')
        ->assertStatus(429)
        ->assertJsonPath('success', false);
    $this->assertGuest('web');
});

it('tidak menimpa 2FA yang sudah terpasang lewat sesi pemasangan lama', function () {
    requireTwoFactor();
    $user = User::factory()->create(['email' => 'rina@contoh.id']);

    $secret = login('rina@contoh.id')->json('data.two_factor_setup.secret');

    // Di tab lain akun ini sudah selesai memasang 2FA dengan kunci berbeda.
    $user->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();

    $this->postJson(panelUrl('two-factor-setups'), ['code' => currentOtp($secret)])->assertStatus(410);
    expect($user->fresh()->two_factor_secret)->toBe('JBSWY3DPEHPK3PXP');
});
