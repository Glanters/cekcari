<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Pengaturan sistem berbentuk key-value yang bisa diubah dari dasbor tanpa deploy ulang.
 */
#[Fillable(['key', 'value', 'created_by', 'updated_by'])]
class AppSetting extends Model
{
    protected function casts(): array
    {
        return [
            'value' => 'json',
        ];
    }

    public static function valueOf(string $key, mixed $default = null): mixed
    {
        $setting = static::query()->where('key', $key)->first();

        return $setting === null ? $default : $setting->value;
    }

    public static function store(string $key, mixed $value, User $changedBy): void
    {
        $setting = static::query()->firstOrNew(['key' => $key]);
        $setting->value = $value;
        $setting->updated_by = $changedBy->id;
        $setting->created_by ??= $changedBy->id;
        $setting->save();
    }
}
