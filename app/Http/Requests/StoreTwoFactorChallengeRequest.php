<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTwoFactorChallengeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Kode 6 digit dari authenticator, atau recovery code bila ponsel hilang.
            'code' => ['required', 'string', 'max:40'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'kode'];
    }
}
