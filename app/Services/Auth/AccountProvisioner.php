<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\AccountCenter\AccountCenterResult;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

/**
 * Menyambungkan identitas Account Center ke akun lokal CekCari lewat email.
 * Akun baru dibuat menunggu aktivasi superadmin, kecuali email superadmin awal dari .env
 * (tanpa itu tidak ada seorang pun yang bisa mengaktifkan akun pertama).
 */
class AccountProvisioner
{
    public function provision(AccountCenterResult $identity): User
    {
        return DB::transaction(function () use ($identity) {
            $user = User::query()->whereEmail($identity->email)->lockForUpdate()->first()
                ?? new User(['email' => $identity->email]);

            $user->name = $identity->name ?? $user->name ?? $identity->email;
            $user->avatar_url = $identity->avatarUrl ?? $user->avatar_url;
            $user->save();

            if (self::isBootstrapSuperadmin($identity->email)) {
                $this->promoteToSuperadmin($user);
            } elseif ($user->roles()->doesntExist()) {
                $user->assignRole(Role::findOrCreate(UserRole::Member->value, 'web'));
            }

            return $user;
        });
    }

    private function promoteToSuperadmin(User $user): void
    {
        $user->syncRoles([Role::findOrCreate(UserRole::Superadmin->value, 'web')]);

        if (! $user->isActive()) {
            $user->forceFill(['activated_at' => now()])->save();
        }
    }

    public static function isBootstrapSuperadmin(string $email): bool
    {
        $emails = collect(explode(',', (string) config('services.accountcenter.superadmin_emails')))
            ->map(fn (string $entry) => mb_strtolower(trim($entry)))
            ->filter();

        return $emails->contains(mb_strtolower($email));
    }
}
