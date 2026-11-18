<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UserIndexRequest extends PaginationRequest
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in([self::STATUS_PENDING, self::STATUS_ACTIVE])],
        ]);
    }

    public function attributes(): array
    {
        return ['q' => 'kata pencarian', 'status' => 'status'];
    }

    public function keyword(): string
    {
        return trim((string) $this->validated('q', ''));
    }

    public function status(): ?string
    {
        return $this->validated('status');
    }
}
