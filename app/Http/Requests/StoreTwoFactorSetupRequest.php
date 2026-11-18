<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTwoFactorSetupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'code' => ['required', 'digits:6'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'kode'];
    }
}
