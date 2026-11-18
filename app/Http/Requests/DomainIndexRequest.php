<?php

namespace App\Http\Requests;

class DomainIndexRequest extends PaginationRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'q' => ['nullable', 'string', 'max:100'],
        ]);
    }

    public function attributes(): array
    {
        return ['q' => 'kata pencarian'];
    }

    public function keyword(): string
    {
        return trim((string) $this->validated('q', ''));
    }
}
