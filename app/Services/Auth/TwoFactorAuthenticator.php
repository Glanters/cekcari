<?php

namespace App\Services\Auth;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * Kode TOTP (Google Authenticator/Authy) dan recovery code untuk login dua langkah.
 */
class TwoFactorAuthenticator
{
    // Toleransi ±1 periode (±30 detik) supaya jam ponsel yang sedikit meleset tetap diterima.
    private const WINDOW = 1;

    private const RECOVERY_CODE_COUNT = 8;

    private const QR_SIZE = 220;

    // Batas per akun (bukan per login), supaya penebak tidak bisa mengulang login untuk mendapat jatah baru.
    private const MAX_FAILURES = 5;

    private const LOCKOUT_SECONDS = 900;

    private const LOCK_SECONDS = 5;

    public function __construct(private readonly Google2FA $google2fa) {}

    public function generateSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    // Data URI supaya QR bisa ditampilkan lewat <img> tanpa menyisipkan SVG mentah ke halaman.
    public function qrCodeDataUri(string $email, string $secret): string
    {
        $otpauthUrl = $this->google2fa->getQRCodeUrl(config('app.name'), $email, $secret);
        $writer = new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE, 1), new SvgImageBackEnd));

        return 'data:image/svg+xml;base64,'.base64_encode($writer->writeString($otpauthUrl));
    }

    /**
     * Kode yang sama tidak bisa dipakai dua kali: hanya periode yang lebih baru dari kode
     * terakhir yang diterima (perlindungan replay).
     */
    public function verifyCode(User $user, string $secret, string $code): bool
    {
        // Dikunci per akun agar dua permintaan bersamaan tidak bisa sama-sama memakai kode yang sama.
        return Cache::lock("two-factor:lock:{$user->id}", self::LOCK_SECONDS)
            ->block(self::LOCK_SECONDS, fn () => $this->verifyCodeOnce($user, $secret, $code));
    }

    private function verifyCodeOnce(User $user, string $secret, string $code): bool
    {
        $lastPeriodKey = "two-factor:last-period:{$user->id}";
        // Wajib integer: dengan null, library mengembalikan true alih-alih nomor periode.
        $lastPeriod = (int) Cache::get($lastPeriodKey, 1);

        $matchedPeriod = $this->google2fa->verifyKeyNewer($secret, $code, $lastPeriod, self::WINDOW);

        if ($matchedPeriod === false) {
            return false;
        }

        Cache::put($lastPeriodKey, (int) $matchedPeriod, now()->addMinutes(5));

        return true;
    }

    /**
     * @return array<int, string>
     */
    public function generateRecoveryCodes(): array
    {
        return collect(range(1, self::RECOVERY_CODE_COUNT))
            ->map(fn () => Str::lower(Str::random(5).'-'.Str::random(5)))
            ->all();
    }

    /**
     * @param  array<int, string>  $codes
     * @return array<int, string>
     */
    public function hashRecoveryCodes(array $codes): array
    {
        return array_map(fn (string $code) => Hash::make($code), $codes);
    }

    // Recovery code hanya berlaku sekali; yang cocok langsung dihapus.
    public function consumeRecoveryCode(User $user, string $code): bool
    {
        return Cache::lock("two-factor:lock:{$user->id}", self::LOCK_SECONDS)
            ->block(self::LOCK_SECONDS, fn () => $this->consumeRecoveryCodeOnce($user->fresh(), $code));
    }

    private function consumeRecoveryCodeOnce(User $user, string $code): bool
    {
        $normalized = Str::lower(trim($code));
        $hashes = $user->two_factor_recovery_codes ?? [];

        foreach ($hashes as $index => $hash) {
            if (Hash::check($normalized, $hash)) {
                unset($hashes[$index]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($hashes)])->save();

                return true;
            }
        }

        return false;
    }

    public function isLockedOut(User $user): bool
    {
        return RateLimiter::tooManyAttempts($this->failureKey($user), self::MAX_FAILURES);
    }

    public function lockoutMessage(User $user): string
    {
        $minutes = max(1, (int) ceil(RateLimiter::availableIn($this->failureKey($user)) / 60));

        return "Terlalu banyak kode 2FA salah untuk akun ini. Coba lagi dalam {$minutes} menit.";
    }

    public function recordFailure(User $user): void
    {
        RateLimiter::hit($this->failureKey($user), self::LOCKOUT_SECONDS);
    }

    public function clearFailures(User $user): void
    {
        RateLimiter::clear($this->failureKey($user));
    }

    private function failureKey(User $user): string
    {
        return "two-factor:failures:{$user->id}";
    }

    public function isTotpCode(string $code): bool
    {
        return preg_match('/^\d{6}$/', $code) === 1;
    }
}
