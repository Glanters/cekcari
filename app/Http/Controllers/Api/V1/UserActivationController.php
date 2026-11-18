<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateUserActivationRequest;
use App\Http\Resources\ManagedUserResource;
use App\Models\User;
use App\Services\Auth\AccountProvisioner;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class UserActivationController extends Controller
{
    public function update(UpdateUserActivationRequest $request, User $user): JsonResponse
    {
        Gate::authorize('manage-users');

        $isActive = $request->boolean('is_active');

        // Mencegah superadmin mengunci dirinya sendiri dari panel.
        if (! $isActive && $user->is($request->user())) {
            $message = 'Anda tidak dapat menonaktifkan akun Anda sendiri.';

            return ApiResponse::error($message, ['is_active' => [$message]], 422);
        }

        // Superadmin dari ACCOUNTCENTER_SUPERADMIN_EMAILS dipulihkan otomatis setiap kali masuk,
        // jadi perubahan dari dasbor tidak akan bertahan; harus dicabut lewat .env.
        if (! $isActive && AccountProvisioner::isBootstrapSuperadmin($user->email)) {
            $message = 'Akun ini superadmin utama dari konfigurasi server. Hapus emailnya dari ACCOUNTCENTER_SUPERADMIN_EMAILS untuk mengubahnya.';

            return ApiResponse::error($message, ['is_active' => [$message]], 422);
        }

        $user->forceFill([
            'activated_at' => $isActive ? ($user->activated_at ?? now()) : null,
            'updated_by' => $request->user()->id,
        ])->save();

        return ApiResponse::success(
            $isActive ? 'Akun berhasil diaktifkan' : 'Akun berhasil dinonaktifkan',
            new ManagedUserResource($user->load('roles')->loadCount('domains')),
        );
    }
}
