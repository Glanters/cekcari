<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'avatar_url', 'activated_at', 'last_login_at', 'created_by', 'updated_by'])]
#[Hidden(['remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles;

    protected function casts(): array
    {
        return [
            'activated_at' => 'datetime',
            'last_login_at' => 'datetime',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }

    public function isActive(): bool
    {
        return $this->activated_at !== null;
    }

    public function isSuperadmin(): bool
    {
        return $this->hasRole(UserRole::Superadmin->value);
    }

    // Setiap akun yang bukan superadmin diperlakukan sebagai member.
    public function role(): UserRole
    {
        return $this->isSuperadmin() ? UserRole::Superadmin : UserRole::Member;
    }

    public function hasConfirmedTwoFactor(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    public function scopeWhereEmail(Builder $query, string $email): void
    {
        $query->whereRaw('LOWER(email) = ?', [mb_strtolower($email)]);
    }
}
