<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Data akun untuk halaman kelola pengguna (khusus superadmin).
 *
 * @mixin User
 */
class ManagedUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_url,
            'role' => $this->role()->value,
            'is_active' => $this->isActive(),
            'has_two_factor' => $this->hasConfirmedTwoFactor(),
            'domains_count' => $this->whenCounted('domains'),
            'activated_at' => $this->activated_at?->toIso8601String(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
