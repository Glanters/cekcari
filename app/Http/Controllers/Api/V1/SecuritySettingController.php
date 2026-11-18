<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSecuritySettingRequest;
use App\Models\IpWhitelistEntry;
use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use App\Support\TwoFactorPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SecuritySettingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        Gate::authorize('manage-security');

        return ApiResponse::success('Pengaturan keamanan berhasil diambil', $this->present($request));
    }

    public function update(UpdateSecuritySettingRequest $request): JsonResponse
    {
        Gate::authorize('manage-security');

        if ($request->has('is_ip_whitelist_enabled')) {
            $isEnabling = $request->boolean('is_ip_whitelist_enabled');

            if ($isEnabling && IpWhitelistEntry::query()->doesntExist()) {
                $message = 'Tambahkan minimal satu alamat IP sebelum menyalakan whitelist.';

                return ApiResponse::error($message, ['is_ip_whitelist_enabled' => [$message]], 422);
            }

            IpWhitelist::setEnabled($isEnabling, $request->user());

            return ApiResponse::success(
                $isEnabling ? 'Whitelist IP aktif: member hanya bisa masuk dari alamat terdaftar' : 'Whitelist IP dimatikan',
                $this->present($request),
            );
        }

        $isRequired = $request->boolean('is_two_factor_required');
        TwoFactorPolicy::setRequired($isRequired, $request->user());

        return ApiResponse::success(
            $isRequired ? '2FA sekarang wajib saat masuk' : '2FA dimatikan: masuk cukup dengan akun Account Center',
            $this->present($request),
        );
    }

    // IP pemanggil ikut dikirim supaya superadmin tahu alamat jaringan yang sedang ia pakai.
    private function present(Request $request): array
    {
        $ip = (string) $request->ip();

        return [
            'is_two_factor_required' => TwoFactorPolicy::isRequired(),
            'is_ip_whitelist_enabled' => IpWhitelist::isEnabled(),
            'current_ip' => $ip,
            'is_current_ip_whitelisted' => IpWhitelist::contains($ip),
        ];
    }
}
