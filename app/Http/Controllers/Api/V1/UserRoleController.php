<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateUserRoleRequest;
use App\Http\Resources\ManagedUserResource;
use App\Models\User;
use App\Services\Auth\AccountProvisioner;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

class UserRoleController extends Controller
{
    public function update(UpdateUserRoleRequest $request, User $user): JsonResponse
    {
        Gate::authorize('manage-users');

        // Superadmin tidak bisa menurunkan perannya sendiri, supaya selalu ada yang bisa mengelola akun.
        if ($user->is($request->user())) {
            $message = 'Anda tidak dapat mengubah peran akun Anda sendiri.';

            return ApiResponse::error($message, ['role' => [$message]], 422);
        }

        // Superadmin dari ACCOUNTCENTER_SUPERADMIN_EMAILS dipulihkan otomatis setiap kali masuk,
        // jadi perubahan dari dasbor tidak akan bertahan; harus dicabut lewat .env.
        if (AccountProvisioner::isBootstrapSuperadmin($user->email)) {
            $message = 'Akun ini superadmin utama dari konfigurasi server. Hapus emailnya dari ACCOUNTCENTER_SUPERADMIN_EMAILS untuk mengubahnya.';

            return ApiResponse::error($message, ['role' => [$message]], 422);
        }

        DB::transaction(function () use ($request, $user) {
            $user->syncRoles([Role::findOrCreate($request->role()->value, 'web')]);
            $user->forceFill(['updated_by' => $request->user()->id])->save();
        });

        return ApiResponse::success(
            'Peran akun berhasil diubah',
            new ManagedUserResource($user->load('roles')->loadCount('domains')),
        );
    }
}
