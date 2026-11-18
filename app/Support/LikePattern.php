<?php

namespace App\Support;

/**
 * Pola LIKE/ILIKE yang aman: karakter %, _, dan \ dari masukan pengguna diperlakukan sebagai teks biasa.
 */
class LikePattern
{
    public static function contains(string $value): string
    {
        return '%'.self::escape($value).'%';
    }

    public static function startsWith(string $value): string
    {
        return self::escape($value).'%';
    }

    private static function escape(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
