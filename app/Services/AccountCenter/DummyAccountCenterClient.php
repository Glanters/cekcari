<?php

namespace App\Services\AccountCenter;

use Illuminate\Support\Str;

/**
 * Pengganti Account Center untuk masa uji (lokal/staging). Email apa pun diterima asalkan
 * password-nya sama dengan ACCOUNTCENTER_DUMMY_PASSWORD. Tidak pernah dipakai di production;
 * lihat pengikatan di AppServiceProvider.
 */
class DummyAccountCenterClient implements AccountCenterClient
{
    public function __construct(private readonly string $password) {}

    public function authenticate(string $email, string $password): AccountCenterResult
    {
        if ($this->password === '' || ! hash_equals($this->password, $password)) {
            return AccountCenterResult::rejected();
        }

        $name = Str::of(Str::before($email, '@'))->replace(['.', '_', '-'], ' ')->title()->toString();

        return AccountCenterResult::authenticated($email, $name, null);
    }
}
