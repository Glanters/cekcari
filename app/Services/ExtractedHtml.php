<?php

namespace App\Services;

final readonly class ExtractedHtml
{
    /**
     * @param  list<string>  $keywords
     * @param  list<string>  $links
     */
    public function __construct(
        public ?string $title,
        public ?string $description,
        public array $keywords,
        public ?string $iconUrl,
        public string $text,
        public array $links,
    ) {}
}
