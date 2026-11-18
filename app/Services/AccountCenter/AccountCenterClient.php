<?php

namespace App\Services\AccountCenter;

/**
 * Account Center hanya membuktikan "email + password ini sah". Akun lokal, aktivasi,
 * peran, dan 2FA tetap diputuskan oleh CekCari.
 */
interface AccountCenterClient
{
    public function authenticate(string $email, string $password): AccountCenterResult;
}
