<?php

namespace App\Services;

final readonly class FetchedPage
{
    public function __construct(
        public string $url,
        public int $status,
        public string $contentType,
        public string $body,
    ) {}

    public function isHtml(): bool
    {
        return str_contains(strtolower($this->contentType), 'text/html')
            || str_contains(strtolower($this->contentType), 'application/xhtml+xml');
    }

    public function isSuccessful(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }
}
