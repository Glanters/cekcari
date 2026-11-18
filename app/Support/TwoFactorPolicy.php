<?php

namespace App\Support;

use App\Models\AppSetting;
use App\Models\User;

/**
 * Wajib atau tidaknya 2FA saat login, diatur superadmin dari dasbor (mis. dimatikan selama masa uji).
 * Saat dimatikan, kunci 2FA yang sudah dipasang pengguna tetap tersimpan, jadi begitu dinyalakan
 * lagi mereka langsung memakai aplikasi authenticator yang sama.
 */
class TwoFactorPolicy
{
    public const SETTING_KEY = 'auth.two_factor_required';

    public static function isRequired(): bool
    {
        // Tanpa pengaturan tersimpan, 2FA dianggap wajib: lebih aman gagal tertutup.
        return (bool) AppSetting::valueOf(self::SETTING_KEY, true);
    }

    public static function setRequired(bool $isRequired, User $changedBy): void
    {
        AppSetting::store(self::SETTING_KEY, $isRequired, $changedBy);
    }
}
