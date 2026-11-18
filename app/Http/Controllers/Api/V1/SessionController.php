<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSessionRequest;
use App\Http\Resources\UserResource;
use App\Services\AccountCenter\AccountCenterClient;
use App\Services\AccountCenter\AccountCenterOutcome;
use App\Services\Auth\AccountProvisioner;
use App\Services\Auth\PendingLogin;
use App\Services\Auth\SessionStarter;
use App\Services\Auth\TwoFactorAuthenticator;
use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use App\Support\TwoFactorPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Langkah pertama login: email + kata sandi diperiksa Account Center. Setelah itu, tergantung
 * pengaturan 2FA, pengguna langsung masuk, diminta kode 2FA, atau diminta memasang 2FA dulu.
 */
class SessionController extends Controller
{
    public const STATUS_AUTHENTICATED = 'authenticated';

    public const STATUS_TWO_FACTOR_CHALLENGE = 'two_factor_challenge';

    public const STATUS_TWO_FACTOR_SETUP = 'two_factor_setup';

    public function __construct(
        private readonly AccountCenterClient $accountCenter,
        private readonly AccountProvisioner $provisioner,
        private readonly PendingLogin $pendingLogin,
        private readonly SessionStarter $sessionStarter,
        private readonly TwoFactorAuthenticator $twoFactor,
    ) {}

    public function store(StoreSessionRequest $request): JsonResponse
    {
        $this->pendingLogin->forget($request);

        $identity = $this->accountCenter->authenticate(
            mb_strtolower($request->validated('email')),
            $request->validated('password'),
        );

        if ($identity->outcome === AccountCenterOutcome::Unavailable) {
            return ApiResponse::error('Account Center sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.', [], 503);
        }

        if (! $identity->isAuthenticated()) {
            $message = 'Email atau kata sandi Account Center salah.';

            return ApiResponse::error($message, ['email' => [$message]], 422);
        }

        $user = $this->provisioner->provision($identity);

        if (! $user->isActive()) {
            return ApiResponse::error(
                'Akun Anda belum diaktifkan. Minta superadmin CekCari mengaktifkan akun ini, lalu masuk lagi.',
                [],
                403,
            );
        }

        $ip = (string) $request->ip();

        if (! IpWhitelist::allowsUser($user, $ip)) {
            return ApiResponse::error(IpWhitelist::rejectionMessage($ip), ['reason' => [IpWhitelist::REJECTION_REASON]], 403);
        }

        if (! TwoFactorPolicy::isRequired()) {
            $this->sessionStarter->start($request, $user);

            return ApiResponse::success('Berhasil masuk', [
                'status' => self::STATUS_AUTHENTICATED,
                'user' => new UserResource($user),
            ]);
        }

        if ($this->twoFactor->isLockedOut($user)) {
            return ApiResponse::error($this->twoFactor->lockoutMessage($user), [], 429);
        }

        if ($user->hasConfirmedTwoFactor()) {
            $this->pendingLogin->start($request, $user);

            return ApiResponse::success('Masukkan kode dari aplikasi authenticator Anda.', [
                'status' => self::STATUS_TWO_FACTOR_CHALLENGE,
            ]);
        }

        $secret = $this->twoFactor->generateSecret();
        $this->pendingLogin->start($request, $user, $secret);

        return ApiResponse::success('Pasang 2FA terlebih dahulu untuk melanjutkan.', [
            'status' => self::STATUS_TWO_FACTOR_SETUP,
            'two_factor_setup' => [
                'qr_code' => $this->twoFactor->qrCodeDataUri($user->email, $secret),
                'secret' => $secret,
            ],
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ApiResponse::success('Berhasil keluar');
    }
}
