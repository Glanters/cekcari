<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTwoFactorChallengeRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\PendingLogin;
use App\Services\Auth\SessionStarter;
use App\Services\Auth\TwoFactorAuthenticator;
use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use Illuminate\Http\JsonResponse;

/**
 * Langkah kedua login untuk akun yang sudah memasang 2FA.
 */
class TwoFactorChallengeController extends Controller
{
    public function __construct(
        private readonly PendingLogin $pendingLogin,
        private readonly SessionStarter $sessionStarter,
        private readonly TwoFactorAuthenticator $twoFactor,
    ) {}

    public function store(StoreTwoFactorChallengeRequest $request): JsonResponse
    {
        $user = $this->pendingLogin->user($request);

        if ($user === null || ! $user->isActive() || ! $user->hasConfirmedTwoFactor()) {
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

        $code = trim($request->validated('code'));
        $isValid = $this->twoFactor->isTotpCode($code)
            ? $this->twoFactor->verifyCode($user, $user->two_factor_secret, $code)
            : $this->twoFactor->consumeRecoveryCode($user, $code);

        if (! $isValid) {
            $this->twoFactor->recordFailure($user);

            if (! $this->pendingLogin->recordFailedAttempt($request)) {
                return ApiResponse::error('Terlalu banyak kode salah. Silakan masuk ulang.', [], 410);
            }

            $message = 'Kode salah atau sudah kedaluwarsa.';

            return ApiResponse::error($message, ['code' => [$message]], 422);
        }

        $this->twoFactor->clearFailures($user);
        $this->sessionStarter->start($request, $user);

        return ApiResponse::success('Berhasil masuk', [
            'status' => SessionController::STATUS_AUTHENTICATED,
            'user' => new UserResource($user),
        ]);
    }
}
