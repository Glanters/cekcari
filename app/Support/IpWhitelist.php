<?php

namespace App\Support;

use App\Models\AppSetting;
use App\Models\IpWhitelistEntry;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Whitelist IP global untuk panel pemilik (sama seperti lacak-hp). Bila aktif, member hanya bisa
 * masuk dan memakai panel dari alamat yang terdaftar. Diperiksa saat login DAN di setiap
 * permintaan, jadi sesi yang sedang berjalan ikut terputus begitu pindah jaringan.
 *
 * Superadmin dikecualikan supaya pengelola tidak bisa mengunci dirinya sendiri dan selalu
 * bisa memperbaiki daftar. Domain pencarian publik tidak terpengaruh.
 */
class IpWhitelist
{
    public const SETTING_KEY = 'security.ip_whitelist_enabled';

    public const MAX_ENTRIES = 200;

    public const REJECTION_REASON = 'ip_not_allowed';

    // Dibaca di setiap permintaan panel, jadi disimpan di cache dan dibuang setiap kali berubah.
    private const CACHE_KEY = 'security:ip-whitelist';

    public static function isEnabled(): bool
    {
        return self::snapshot()['is_enabled'];
    }

    /**
     * Whitelist yang aktif tetapi kosong dianggap mati, supaya tidak ada yang terkunci karena salah urutan.
     */
    public static function allows(string $ip): bool
    {
        $ip = self::unmapIpv4($ip);
        $snapshot = self::snapshot();

        if (! $snapshot['is_enabled'] || $snapshot['entries'] === []) {
            return true;
        }

        return IpUtils::checkIp($ip, $snapshot['entries']);
    }

    // Apakah alamat ini tercakup daftar, terlepas dari whitelist sedang aktif atau tidak.
    public static function contains(string $ip): bool
    {
        $entries = self::snapshot()['entries'];

        return $entries !== [] && IpUtils::checkIp(self::unmapIpv4($ip), $entries);
    }

    // Server dengan soket IPv6 bisa melaporkan "::ffff:10.0.0.5"; dicocokkan sebagai 10.0.0.5.
    private static function unmapIpv4(string $ip): string
    {
        return preg_match('/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i', $ip, $matches) === 1 ? $matches[1] : $ip;
    }

    public static function allowsUser(User $user, string $ip): bool
    {
        return $user->isSuperadmin() || self::allows($ip);
    }

    public static function rejectionMessage(string $ip): string
    {
        return "Akses panel hanya diizinkan dari jaringan yang terdaftar. IP Anda ({$ip}) tidak ada di whitelist. Hubungi superadmin CekCari.";
    }

    public static function setEnabled(bool $isEnabled, User $changedBy): void
    {
        AppSetting::store(self::SETTING_KEY, $isEnabled, $changedBy);
        self::forgetCache();
    }

    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Bentuk baku sebuah entri ("10.0.0.5", "10.0.0.0/24", "2001:db8::/32"), atau null bila tidak sah.
     * Prefix /0 ditolak karena sama saja mengizinkan semua alamat.
     */
    public static function normalize(string $value): ?string
    {
        $parts = explode('/', trim($value));

        if (count($parts) > 2 || filter_var($parts[0], FILTER_VALIDATE_IP) === false) {
            return null;
        }

        $address = inet_ntop(inet_pton($parts[0]));

        if (count($parts) === 1) {
            return $address;
        }

        $maxPrefix = str_contains($address, ':') ? 128 : 32;
        $isValidPrefix = preg_match('/^\d{1,3}$/', $parts[1]) === 1 && (int) $parts[1] >= 1 && (int) $parts[1] <= $maxPrefix;

        return $isValidPrefix ? $address.'/'.(int) $parts[1] : null;
    }

    /**
     * @return array{is_enabled: bool, entries: array<int, string>}
     */
    private static function snapshot(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => [
            'is_enabled' => (bool) AppSetting::valueOf(self::SETTING_KEY, false),
            'entries' => IpWhitelistEntry::query()->pluck('value')->all(),
        ]);
    }
}
