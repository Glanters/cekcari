<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDomainPromotionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'is_promoted' => ['required', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['is_promoted' => 'status promosi'];
    }
}
