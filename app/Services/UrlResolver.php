<?php

namespace App\Services;

/**
 * Mengubah tautan relatif di halaman menjadi URL absolut yang seragam,
 * supaya halaman yang sama tidak tersimpan dua kali dengan penulisan berbeda.
 */
class UrlResolver
{
    public function resolve(string $baseUrl, string $href): ?string
    {
        $href = trim($href);

        if ($href === '' || str_starts_with($href, '#') || preg_match('/^(mailto|tel|javascript|data):/i', $href)) {
            return null;
        }

        $base = parse_url($baseUrl);

        if (! isset($base['scheme'], $base['host'])) {
            return null;
        }

        if (str_starts_with($href, '//')) {
            $href = $base['scheme'].':'.$href;
        }

        if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $href)) {
            return $this->normalize($href);
        }

        $origin = $base['scheme'].'://'.$base['host'].(isset($base['port']) ? ':'.$base['port'] : '');
        $basePath = $base['path'] ?? '/';

        if (str_starts_with($href, '?')) {
            return $this->normalize($origin.$basePath.$href);
        }

        if (str_starts_with($href, '/')) {
            return $this->normalize($origin.$href);
        }

        $directory = substr($basePath, 0, (int) strrpos($basePath, '/') + 1);

        return $this->normalize($origin.$directory.$href);
    }

    public function normalize(string $url): ?string
    {
        $parts = parse_url($url);

        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $scheme = strtolower($parts['scheme']);

        if (! in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower($parts['host']);
        $isDefaultPort = ! isset($parts['port'])
            || ($scheme === 'http' && $parts['port'] === 80)
            || ($scheme === 'https' && $parts['port'] === 443);
        $port = $isDefaultPort ? '' : ':'.$parts['port'];
        $path = $this->removeDotSegments($parts['path'] ?? '/');
        $query = isset($parts['query']) && $parts['query'] !== '' ? '?'.$parts['query'] : '';

        return $scheme.'://'.$host.$port.$path.$query;
    }

    private function removeDotSegments(string $path): string
    {
        $segments = [];

        foreach (explode('/', $path) as $segment) {
            if ($segment === '..') {
                array_pop($segments);
            } elseif ($segment !== '.') {
                $segments[] = $segment;
            }
        }

        $cleanPath = implode('/', $segments);

        return str_starts_with($cleanPath, '/') ? $cleanPath : '/'.$cleanPath;
    }
}
