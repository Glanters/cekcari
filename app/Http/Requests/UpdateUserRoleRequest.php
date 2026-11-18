<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRoleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'role' => ['required', Rule::enum(UserRole::class)],
        ];
    }

    public function attributes(): array
    {
        return ['role' => 'peran'];
    }

    public function role(): UserRole
    {
        return UserRole::from($this->validated('role'));
    }
}
