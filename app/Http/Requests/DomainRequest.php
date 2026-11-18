<?php

namespace App\Http\Requests;

use App\Models\Domain;
use App\Services\DomainService;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Pemilik hanya mengisi link situs; data lain diambil otomatis dari situs tersebut.
 */
class DomainRequest extends FormRequest
{
    // Pemilik boleh menulis alamat polos seperti "psms.com"; skema https dipakai sebagai bawaan.
    protected function prepareForValidation(): void
    {
        $url = trim((string) $this->input('url'));

        if ($url !== '' && preg_match('#^[a-z][a-z0-9+.-]*://#i', $url) !== 1) {
            $url = 'https://'.$url;
        }

        $this->merge(['url' => $url]);
    }

    public function rules(): array
    {
        return [
            'url' => ['required', 'string', 'max:255', 'url:http,https', $this->linkNotYetRegistered(...)],
        ];
    }

    public function attributes(): array
    {
        return ['url' => 'link situs'];
    }

    // Satu domain boleh punya beberapa link (path berbeda), tapi link yang sama hanya boleh terdaftar sekali.
    private function linkNotYetRegistered(string $attribute, mixed $value, Closure $fail): void
    {
        /** @var Domain|null $currentDomain */
        $currentDomain = $this->route('domain');

        $existingDomain = Domain::withAddress(DomainService::addressOf((string) $value))
            ->when($currentDomain, fn ($query) => $query->whereKeyNot($currentDomain->id))
            ->first();

        if ($existingDomain === null) {
            return;
        }

        $fail($existingDomain->user_id === $this->user()->id
            ? 'Link ini sudah ada di daftar Anda.'
            : 'Link ini sudah didaftarkan oleh akun lain.');
    }
}
