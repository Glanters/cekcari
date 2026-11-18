<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

/**
 * Login yang sudah lolos Account Center tetapi belum lolos 2FA. Disimpan di sesi server
 * (bukan dikirim ke browser), berlaku singkat, dan dibatalkan setelah terlalu banyak kode salah.
 */
class PendingLogin
{
    private const SESSION_KEY = 'auth.pending_login';

    private const TTL_MINUTES = 10;

    private const MAX_FAILED_ATTEMPTS = 5;

    public function start(Request $request, User $user, ?string $setupSecret = null): void
    {
        $request->session()->put(self::SESSION_KEY, [
            'user_id' => $user->id,
            'setup_secret' => $setupSecret === null ? null : Crypt::encryptString($setupSecret),
            'expires_at' => now()->addMinutes(self::TTL_MINUTES)->getTimestamp(),
            'failed_attempts' => 0,
        ]);
    }

    public function user(Request $request): ?User
    {
        $pending = $this->current($request);

        return $pending === null ? null : User::query()->find($pending['user_id']);
    }

    public function setupSecret(Request $request): ?string
    {
        $encrypted = $this->current($request)['setup_secret'] ?? null;

        return $encrypted === null ? null : Crypt::decryptString($encrypted);
    }

    /**
     * Mencatat kode yang salah. Mengembalikan false bila batas percobaan sudah habis
     * (login yang tertunda langsung dibatalkan).
     */
    public function recordFailedAttempt(Request $request): bool
    {
        $pending = $this->current($request);

        if ($pending === null) {
            return false;
        }

        $pending['failed_attempts']++;

        if ($pending['failed_attempts'] >= self::MAX_FAILED_ATTEMPTS) {
            $this->forget($request);

            return false;
        }

        $request->session()->put(self::SESSION_KEY, $pending);

        return true;
    }

    public function forget(Request $request): void
    {
        $request->session()->forget(self::SESSION_KEY);
    }

    /**
     * @return array{user_id: int, setup_secret: ?string, expires_at: int, failed_attempts: int}|null
     */
    private function current(Request $request): ?array
    {
        $pending = $request->session()->get(self::SESSION_KEY);

        if (! is_array($pending) || $pending['expires_at'] < now()->getTimestamp()) {
            return null;
        }

        return $pending;
    }
}
