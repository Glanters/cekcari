<?php

use App\Models\IpWhitelistEntry;
use App\Models\User;
use App\Support\IpWhitelist;
use App\Support\TwoFactorPolicy;
use PragmaRX\Google2FA\Google2FA;

beforeEach(function () {
    $this->withHeader('Origin', 'http://'.config('domains.panel'));
    fakeAccountCenter();
});

function whitelist(array $values, bool $isEnabled = true): void
{
    $admin = superadmin();

    foreach ($values as $value) {
        IpWhitelistEntry::create(['value' => $value, 'created_by' => $admin->id, 'updated_by' => $admin->id]);
    }

    IpWhitelist::setEnabled($isEnabled, $admin);
}

function fromIp(string $ip)
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip]);
}

it('mencocokkan alamat tunggal dan rentang CIDR IPv4 maupun IPv6', function () {
    whitelist(['103.10.20.30', '10.8.0.0/16', '2001:db8::/32']);

    expect(IpWhitelist::allows('103.10.20.30'))->toBeTrue()
        ->and(IpWhitelist::allows('10.8.255.1'))->toBeTrue()
        ->and(IpWhitelist::allows('2001:db8::1'))->toBeTrue()
        ->and(IpWhitelist::allows('103.10.20.31'))->toBeFalse()
        ->and(IpWhitelist::allows('10.9.0.1'))->toBeFalse();
});

it('membakukan entri dan menolak alamat yang tidak sah', function () {
    expect(IpWhitelist::normalize(' 10.0.0.5 '))->toBe('10.0.0.5')
        ->and(IpWhitelist::normalize('10.0.0.0/24'))->toBe('10.0.0.0/24')
        ->and(IpWhitelist::normalize('2001:DB8:0::1'))->toBe('2001:db8::1')
        ->and(IpWhitelist::normalize('10.0.0.0/0'))->toBeNull()
        ->and(IpWhitelist::normalize('10.0.0.0/33'))->toBeNull()
        ->and(IpWhitelist::normalize('kantor'))->toBeNull()
        ->and(IpWhitelist::normalize('10.0.0.1/24/8'))->toBeNull();
});

it('tidak membatasi siapa pun selama whitelist mati', function () {
    whitelist(['103.10.20.30'], isEnabled: false);
    User::factory()->create(['email' => 'rina@contoh.id']);

    fromIp('8.8.8.8')->postJson(panelUrl('sessions'), ['email' => 'rina@contoh.id', 'password' => 'rahasia'])->assertOk();
});

it('menolak login member dari IP di luar whitelist', function () {
    whitelist(['103.10.20.0/24']);
    User::factory()->create(['email' => 'rina@contoh.id']);

    fromIp('8.8.8.8')->postJson(panelUrl('sessions'), ['email' => 'rina@contoh.id', 'password' => 'rahasia'])
        ->assertForbidden()
        ->assertJsonPath('errors.reason.0', 'ip_not_allowed');

    $this->assertGuest('web');

    fromIp('103.10.20.7')->postJson(panelUrl('sessions'), ['email' => 'rina@contoh.id', 'password' => 'rahasia'])->assertOk();
});

it('memutus sesi member yang pindah ke jaringan lain', function () {
    whitelist(['103.10.20.0/24']);
    $member = User::factory()->create();

    $this->actingAs($member);
    fromIp('103.10.20.7')->getJson(panelUrl('profile'))->assertOk();
    fromIp('8.8.8.8')->getJson(panelUrl('profile'))
        ->assertForbidden()
        ->assertJsonPath('errors.reason.0', 'ip_not_allowed');

    $this->assertGuest('web');
});

it('tidak pernah mengunci superadmin', function () {
    whitelist(['103.10.20.0/24']);
    config(['services.accountcenter.superadmin_emails' => 'bos@contoh.id']);

    fromIp('8.8.8.8')->postJson(panelUrl('sessions'), ['email' => 'bos@contoh.id', 'password' => 'rahasia'])->assertOk();
    fromIp('8.8.8.8')->getJson(panelUrl('profile'))->assertOk();
});

it('tidak memengaruhi pencarian publik', function () {
    whitelist(['103.10.20.0/24']);

    fromIp('8.8.8.8')->getJson(searchUrl('search-results?q=kopi'))->assertOk();
});

it('superadmin mengelola daftar dan tidak bisa menyalakan whitelist kosong', function () {
    $admin = superadmin();
    $this->actingAs($admin);

    $this->putJson(panelUrl('security-settings'), ['is_ip_whitelist_enabled' => true])->assertStatus(422);

    $created = $this->postJson(panelUrl('ip-whitelist-entries'), ['value' => ' 103.10.20.0/24 ', 'label' => 'Kantor Surabaya'])
        ->assertCreated()
        ->assertJsonPath('data.value', '103.10.20.0/24')
        ->assertJsonPath('data.label', 'Kantor Surabaya');

    $this->postJson(panelUrl('ip-whitelist-entries'), ['value' => '103.10.20.0/24'])
        ->assertStatus(422)
        ->assertJsonPath('errors.value.0', 'Alamat ini sudah ada di whitelist.');
    $this->postJson(panelUrl('ip-whitelist-entries'), ['value' => 'bukan-ip'])->assertStatus(422);

    fromIp('103.10.20.9')->putJson(panelUrl('security-settings'), ['is_ip_whitelist_enabled' => true])
        ->assertOk()
        ->assertJsonPath('data.is_ip_whitelist_enabled', true)
        ->assertJsonPath('data.current_ip', '103.10.20.9')
        ->assertJsonPath('data.is_current_ip_whitelisted', true);

    $this->getJson(panelUrl('ip-whitelist-entries'))->assertOk()->assertJsonCount(1, 'data.items');

    // Alamat terakhir tidak boleh dihapus selama whitelist aktif.
    $entryId = $created->json('data.id');
    $this->deleteJson(panelUrl("ip-whitelist-entries/{$entryId}"))->assertStatus(422);

    $this->putJson(panelUrl('security-settings'), ['is_ip_whitelist_enabled' => false])->assertOk();
    $this->deleteJson(panelUrl("ip-whitelist-entries/{$entryId}"))->assertOk();

    expect(IpWhitelistEntry::query()->count())->toBe(0);
});

it('hanya superadmin yang boleh mengelola whitelist', function () {
    $this->actingAs(User::factory()->create());

    $this->getJson(panelUrl('ip-whitelist-entries'))->assertForbidden();
    $this->postJson(panelUrl('ip-whitelist-entries'), ['value' => '10.0.0.1'])->assertForbidden();
    $this->putJson(panelUrl('security-settings'), ['is_ip_whitelist_enabled' => false])->assertForbidden();
});

it('memeriksa whitelist juga di langkah kode 2FA', function () {
    whitelist(['103.10.20.0/24']);
    TwoFactorPolicy::setRequired(true, superadmin());
    User::factory()->create(['email' => 'rina@contoh.id'])
        ->forceFill(['two_factor_secret' => (new Google2FA)->generateSecretKey(32), 'two_factor_confirmed_at' => now()])
        ->save();

    fromIp('103.10.20.7')->postJson(panelUrl('sessions'), ['email' => 'rina@contoh.id', 'password' => 'rahasia'])
        ->assertJsonPath('data.status', 'two_factor_challenge');

    fromIp('8.8.8.8')->postJson(panelUrl('two-factor-challenges'), ['code' => '123456'])
        ->assertForbidden()
        ->assertJsonPath('errors.reason.0', 'ip_not_allowed');
    $this->assertGuest('web');
});

it('mengenali alamat IPv4 yang dilaporkan dalam bentuk IPv6', function () {
    whitelist(['103.10.20.0/24']);

    expect(IpWhitelist::allows('::ffff:103.10.20.7'))->toBeTrue()
        ->and(IpWhitelist::allows('::ffff:8.8.8.8'))->toBeFalse();
});
