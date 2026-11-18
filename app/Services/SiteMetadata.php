<?php

namespace App\Services;

final readonly class SiteMetadata
{
    /**
     * @param  list<string>  $tags
     */
    public function __construct(
        public string $title,
        public string $description,
        public array $tags,
        public ?string $iconUrl,
    ) {}
}
