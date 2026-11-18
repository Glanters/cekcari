<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTwoFactorSetupRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\PendingLogin;
use App\Services\Auth\SessionStarter;
use App\Services\Auth\TwoFactorAuthenticator;
use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Pemasangan 2FA pertama kali, di tengah proses login. Kunci baru disimpan hanya setelah
 * pengguna membuktikan authenticator-nya sudah menghasilkan kode yang benar.
 */
class TwoFactorSetupController extends Controller
{
    public function __construct(
        private readonly PendingLogin $pendingLogin,
        private readonly SessionStarter $sessionStarter,
        private readonly TwoFactorAuthenticator $twoFactor,
    ) {}

    public function store(StoreTwoFactorSetupRequest $request): JsonResponse
    {
        $user = $this->pendingLogin->user($request);
        $secret = $this->pendingLogin->setupSecret($request);

        // Akun yang sudah memasang 2FA (mis. di tab lain) tidak boleh ditimpa lewat sesi pemasangan lama.
        if ($user === null || $secret === null || ! $user->isActive() || $user->hasConfirmedTwoFactor()) {
            $this->pendingLogin->forget($request);

            return ApiResponse::error('Sesi masuk sudah berakhir. Silakan masuk ulang.', [], 410);
        }

        $ip = (string) $request->ip();

        if (! IpWhitelist::allowsUser($user, $ip)) {
            $this->pendingLogin->forget($request);

            return ApiResponse::error(IpWhitelist::rejectionMessage($ip), ['reason' => [IpWhitelist::REJECTION_REASON]], 403);
        }

        if ($this->twoFactor->isLockedOut($user)) {
            $this->pendingLogin->forget($request);

            return ApiResponse::error($this->twoFactor->lockoutMessage($user), [], 429);
        }

        if (! $this->twoFactor->verifyCode($user, $secret, $request->validated('code'))) {
            $this->twoFactor->recordFailure($user);

            if (! $this->pendingLogin->recordFailedAttempt($request)) {
                return ApiResponse::error('Terlalu banyak kode salah. Silakan masuk ulang.', [], 410);
            }

            $message = 'Kode salah. Pastikan jam ponsel Anda tepat, lalu coba kode terbaru.';

            return ApiResponse::error($message, ['code' => [$message]], 422);
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();

        DB::transaction(function () use ($user, $secret, $recoveryCodes) {
            $user->forceFill([
                'two_factor_secret' => $secret,
                'two_factor_recovery_codes' => $this->twoFactor->hashRecoveryCodes($recoveryCodes),
                'two_factor_confirmed_at' => now(),
            ])->save();
        });

        $this->twoFactor->clearFailures($user);
        $this->sessionStarter->start($request, $user);

        return ApiResponse::success('2FA aktif. Simpan recovery code Anda di tempat aman.', [
            'status' => SessionController::STATUS_AUTHENTICATED,
            'user' => new UserResource($user),
            'recovery_codes' => $recoveryCodes,
        ]);
    }
}
