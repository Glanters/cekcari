<?php

namespace App\Enums;

enum UserRole: string
{
    case Superadmin = 'superadmin';
    case Member = 'member';

    public function label(): string
    {
        return match ($this) {
            self::Superadmin => 'Superadmin',
            self::Member => 'Member',
        };
    }
}
