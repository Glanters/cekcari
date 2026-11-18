<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSecuritySettingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'is_two_factor_required' => ['required_without:is_ip_whitelist_enabled', 'boolean'],
            'is_ip_whitelist_enabled' => ['required_without:is_two_factor_required', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'is_two_factor_required' => 'kewajiban 2FA',
            'is_ip_whitelist_enabled' => 'whitelist IP',
        ];
    }
}
