<?php

namespace App\Http\Requests;

use App\Support\IpWhitelist;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIpWhitelistEntryRequest extends FormRequest
{
    // Disimpan dalam bentuk baku agar "10.0.0.5" dan " 10.0.0.5 " dianggap entri yang sama.
    protected function prepareForValidation(): void
    {
        $normalized = IpWhitelist::normalize((string) $this->input('value', ''));

        if ($normalized !== null) {
            $this->merge(['value' => $normalized]);
        }

        $this->merge(['label' => trim((string) $this->input('label', '')) ?: null]);
    }

    public function rules(): array
    {
        return [
            'value' => [
                'required',
                'string',
                'max:64',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (IpWhitelist::normalize((string) $value) === null) {
                        $fail('Isi alamat IP (mis. 103.10.20.30) atau rentang CIDR (mis. 103.10.20.0/24) yang valid.');
                    }
                },
                Rule::unique('ip_whitelist_entries', 'value'),
            ],
            'label' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function attributes(): array
    {
        return ['value' => 'alamat IP', 'label' => 'keterangan'];
    }

    public function messages(): array
    {
        return ['value.unique' => 'Alamat ini sudah ada di whitelist.'];
    }
}
