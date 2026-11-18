<?php

namespace App\Http\Requests;

class SearchRequest extends PaginationRequest
{
    private const MAX_SEED = 2147483647;

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'q' => ['required', 'string', 'max:200'],
            // Angka acak milik pengunjung; urutan hasil tetap sama selama seed-nya sama.
            'seed' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_SEED],
        ]);
    }

    public function attributes(): array
    {
        return ['q' => 'kata kunci', 'seed' => 'seed urutan'];
    }

    public function seed(): ?int
    {
        $seed = $this->validated('seed');

        return $seed === null ? null : (int) $seed;
    }
}
