<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Support\TwoFactorPolicy;

beforeEach(function () {
    $this->withHeader('Origin', 'http://'.config('domains.panel'));
});

it('hanya superadmin yang boleh mengelola pengguna dan keamanan', function () {
    $member = User::factory()->create();
    $other = User::factory()->create();

    $this->actingAs($member);
    $this->getJson(panelUrl('users'))->assertForbidden();
    $this->putJson(panelUrl("users/{$other->id}/activation"), ['is_active' => false])->assertForbidden();
    $this->putJson(panelUrl("users/{$other->id}/role"), ['role' => 'superadmin'])->assertForbidden();
    $this->getJson(panelUrl('security-settings'))->assertForbidden();
    $this->putJson(panelUrl('security-settings'), ['is_two_factor_required' => false])->assertForbidden();

    expect($other->fresh()->isActive())->toBeTrue();
});

it('menampilkan akun yang menunggu aktivasi paling atas', function () {
    $admin = superadmin();
    User::factory()->create(['name' => 'Sudah Aktif']);
    $pending = User::factory()->create(['name' => 'Menunggu', 'activated_at' => null]);

    $this->actingAs($admin)->getJson(panelUrl('users'))
        ->assertOk()
        ->assertJsonPath('data.items.0.id', $pending->id)
        ->assertJsonPath('data.items.0.is_active', false)
        ->assertJsonPath('data.pending_count', 1)
        ->assertJsonPath('data.pagination.total', 3);

    $this->getJson(panelUrl('users?status=pending&q=NUNGGU'))
        ->assertOk()
        ->assertJsonCount(1, 'data.items');
});

it('mengaktifkan dan menonaktifkan akun', function () {
    $admin = superadmin();
    $user = User::factory()->create(['activated_at' => null]);

    $this->actingAs($admin)->putJson(panelUrl("users/{$user->id}/activation"), ['is_active' => true])
        ->assertOk()
        ->assertJsonPath('data.is_active', true);

    expect($user->fresh())->isActive()->toBeTrue()->updated_by->toBe($admin->id);

    $this->putJson(panelUrl("users/{$user->id}/activation"), ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);
});

it('mencegah superadmin menonaktifkan atau menurunkan dirinya sendiri', function () {
    $admin = superadmin();

    $this->actingAs($admin);
    $this->putJson(panelUrl("users/{$admin->id}/activation"), ['is_active' => false])->assertStatus(422);
    $this->putJson(panelUrl("users/{$admin->id}/role"), ['role' => 'member'])->assertStatus(422);

    expect($admin->fresh())->isActive()->toBeTrue()->isSuperadmin()->toBeTrue();
});

it('mengubah peran akun lain', function () {
    $admin = superadmin();
    $user = User::factory()->create();

    $this->actingAs($admin)->putJson(panelUrl("users/{$user->id}/role"), ['role' => 'superadmin'])
        ->assertOk()
        ->assertJsonPath('data.role', 'superadmin');

    expect($user->fresh()->role())->toBe(UserRole::Superadmin);

    $this->putJson(panelUrl("users/{$user->id}/role"), ['role' => 'raja'])->assertStatus(422);
});

it('superadmin bisa menyalakan dan mematikan kewajiban 2FA', function () {
    $admin = superadmin();

    $this->actingAs($admin)->getJson(panelUrl('security-settings'))
        ->assertOk()
        ->assertJsonPath('data.is_two_factor_required', false);

    $this->putJson(panelUrl('security-settings'), ['is_two_factor_required' => true])
        ->assertOk()
        ->assertJsonPath('data.is_two_factor_required', true);

    expect(TwoFactorPolicy::isRequired())->toBeTrue();
});

it('mereset 2FA pengguna sehingga login berikutnya diminta memasang ulang', function () {
    $admin = superadmin();
    $user = User::factory()->create(['email' => 'rina@contoh.id']);
    $user->forceFill([
        'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
        'two_factor_recovery_codes' => [bcrypt('abcde-12345')],
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->actingAs($admin)->deleteJson(panelUrl("users/{$user->id}/two-factor"))
        ->assertOk()
        ->assertJsonPath('data.has_two_factor', false);

    expect($user->fresh())
        ->two_factor_secret->toBeNull()
        ->two_factor_recovery_codes->toBeNull()
        ->updated_by->toBe($admin->id);

    $this->actingAs(User::factory()->create())->deleteJson(panelUrl("users/{$user->id}/two-factor"))->assertForbidden();
});

it('menolak menonaktifkan atau menurunkan superadmin utama dari .env', function () {
    config(['services.accountcenter.superadmin_emails' => 'bos@contoh.id']);
    $admin = superadmin();
    $root = superadmin(['email' => 'bos@contoh.id']);

    $this->actingAs($admin);
    $this->putJson(panelUrl("users/{$root->id}/activation"), ['is_active' => false])->assertStatus(422);
    $this->putJson(panelUrl("users/{$root->id}/role"), ['role' => 'member'])->assertStatus(422);

    expect($root->fresh())->isActive()->toBeTrue()->isSuperadmin()->toBeTrue();
});
