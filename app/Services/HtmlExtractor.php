<?php

namespace App\Services;

use DOMDocument;
use DOMXPath;

class HtmlExtractor
{
    private const NON_CONTENT_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas'];

    public function __construct(private readonly UrlResolver $urlResolver) {}

    public function extract(string $html, string $pageUrl): ExtractedHtml
    {
        $xpath = new DOMXPath($this->loadDocument($html));

        return new ExtractedHtml(
            title: $this->firstValue($xpath, ['//title', '//meta[@property="og:title"]/@content']),
            description: $this->firstValue($xpath, [
                '//meta[translate(@name, "DESCRIPTION", "description")="description"]/@content',
                '//meta[@property="og:description"]/@content',
            ]),
            keywords: $this->keywords($xpath),
            iconUrl: $this->iconUrl($xpath, $pageUrl),
            text: $this->visibleText($xpath),
            links: $this->links($xpath, $pageUrl),
        );
    }

    private function loadDocument(string $html): DOMDocument
    {
        $document = new DOMDocument;
        // HTML dari situs luar hampir selalu tidak valid sempurna; peringatan libxml tidak relevan di sini.
        $previousSetting = libxml_use_internal_errors(true);
        // Deklarasi encoding memaksa libxml membaca UTF-8, bukan ISO-8859-1 bawaannya.
        $document->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($previousSetting);

        return $document;
    }

    /**
     * @param  list<string>  $expressions
     */
    private function firstValue(DOMXPath $xpath, array $expressions): ?string
    {
        foreach ($expressions as $expression) {
            $node = $xpath->query($expression)?->item(0);
            $value = $node ? $this->cleanWhitespace($node->textContent) : '';

            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function keywords(DOMXPath $xpath): array
    {
        $rawKeywords = $this->firstValue($xpath, ['//meta[translate(@name, "KEYWORDS", "keywords")="keywords"]/@content']);

        if ($rawKeywords === null) {
            return [];
        }

        $keywords = array_map(fn (string $keyword) => mb_strtolower(trim($keyword)), explode(',', $rawKeywords));

        return array_values(array_unique(array_filter($keywords, fn (string $keyword) => $keyword !== '')));
    }

    // apple-touch-icon didahulukan karena biasanya beresolusi lebih tinggi dari favicon biasa.
    private function iconUrl(DOMXPath $xpath, string $pageUrl): ?string
    {
        $href = $this->firstValue($xpath, [
            '//link[contains(translate(@rel, "APLETOUCHIN", "apletouchin"), "apple-touch-icon")]/@href',
            '//link[contains(concat(" ", translate(@rel, "ICON", "icon"), " "), " icon ")]/@href',
        ]);

        return $href !== null ? $this->urlResolver->resolve($pageUrl, $href) : null;
    }

    private function visibleText(DOMXPath $xpath): string
    {
        foreach (self::NON_CONTENT_TAGS as $tagName) {
            foreach (iterator_to_array($xpath->query('//'.$tagName)) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }

        $body = $xpath->query('//body')->item(0);
        $text = $this->cleanWhitespace($body?->textContent ?? '');

        return mb_substr($text, 0, config('crawler.max_content_chars'));
    }

    /**
     * @return list<string>
     */
    private function links(DOMXPath $xpath, string $pageUrl): array
    {
        $links = [];

        foreach ($xpath->query('//a[@href]') as $anchor) {
            $rel = strtolower($anchor->getAttribute('rel'));

            if (str_contains($rel, 'nofollow')) {
                continue;
            }

            $absoluteUrl = $this->urlResolver->resolve($pageUrl, $anchor->getAttribute('href'));

            if ($absoluteUrl !== null) {
                $links[$absoluteUrl] = true;
            }
        }

        return array_keys($links);
    }

    private function cleanWhitespace(string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }
}
