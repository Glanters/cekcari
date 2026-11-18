<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ManagedUserResource;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;

/**
 * Reset 2FA untuk pengguna yang kehilangan atau mengganti ponsel. Kunci dan recovery code lama
 * langsung tidak berlaku; saat 2FA diwajibkan, login berikutnya meminta pemasangan ulang.
 */
class UserTwoFactorController extends Controller
{
    public function destroy(Request $request, User $user): JsonResponse
    {
        Gate::authorize('manage-users');

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'updated_by' => $request->user()->id,
        ])->save();

        Cache::forget("two-factor:last-period:{$user->id}");

        return ApiResponse::success(
            '2FA berhasil direset',
            new ManagedUserResource($user->load('roles')->loadCount('domains')),
        );
    }
}
