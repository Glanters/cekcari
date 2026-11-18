<?php

namespace App\Services\AccountCenter;

final readonly class AccountCenterResult
{
    private function __construct(
        public AccountCenterOutcome $outcome,
        public ?string $email = null,
        public ?string $name = null,
        public ?string $avatarUrl = null,
    ) {}

    public static function authenticated(string $email, ?string $name, ?string $avatarUrl): self
    {
        return new self(AccountCenterOutcome::Authenticated, mb_strtolower($email), $name, $avatarUrl);
    }

    public static function rejected(): self
    {
        return new self(AccountCenterOutcome::Rejected);
    }

    public static function unavailable(): self
    {
        return new self(AccountCenterOutcome::Unavailable);
    }

    public function isAuthenticated(): bool
    {
        return $this->outcome === AccountCenterOutcome::Authenticated;
    }
}
