<?php

namespace App\Services;

/**
 * Aturan robots.txt yang berlaku untuk crawler ini (grup "*" atau grup dengan nama bot kita).
 * Aturan paling spesifik (pola terpanjang) yang menang, sesuai RFC 9309.
 */
class RobotsRules
{
    /**
     * @param  list<array{pattern: string, isAllowed: bool}>  $rules
     */
    private function __construct(private readonly array $rules) {}

    public static function allowAll(): self
    {
        return new self([]);
    }

    public static function parse(string $robotsTxt, string $userAgent): self
    {
        $botName = strtolower(strtok($userAgent, '/') ?: $userAgent);
        $groups = self::groupLines($robotsTxt);
        $specificRules = [];
        $wildcardRules = [];

        foreach ($groups as $group) {
            if (in_array($botName, $group['agents'], true)) {
                array_push($specificRules, ...$group['rules']);
            } elseif (in_array('*', $group['agents'], true)) {
                array_push($wildcardRules, ...$group['rules']);
            }
        }

        return new self($specificRules !== [] ? $specificRules : $wildcardRules);
    }

    public function isAllowed(string $url): bool
    {
        $path = (parse_url($url, PHP_URL_PATH) ?: '/').(($query = parse_url($url, PHP_URL_QUERY)) ? '?'.$query : '');
        $bestMatchLength = -1;
        $isAllowed = true;

        foreach ($this->rules as $rule) {
            if (! $this->matches($rule['pattern'], $path)) {
                continue;
            }

            $length = strlen($rule['pattern']);

            if ($length > $bestMatchLength || ($length === $bestMatchLength && $rule['isAllowed'])) {
                $bestMatchLength = $length;
                $isAllowed = $rule['isAllowed'];
            }
        }

        return $isAllowed;
    }

    private function matches(string $pattern, string $path): bool
    {
        $isAnchoredEnd = str_ends_with($pattern, '$');
        $body = $isAnchoredEnd ? substr($pattern, 0, -1) : $pattern;
        $regex = str_replace('\*', '.*', preg_quote($body, '#'));

        return (bool) preg_match('#^'.$regex.($isAnchoredEnd ? '$' : '').'#', $path);
    }

    /**
     * @return list<array{agents: list<string>, rules: list<array{pattern: string, isAllowed: bool}>}>
     */
    private static function groupLines(string $robotsTxt): array
    {
        $groups = [];
        $current = null;
        $isReadingAgents = false;

        foreach (preg_split('/\r\n|\r|\n/', $robotsTxt) as $line) {
            $line = trim(preg_replace('/#.*$/', '', $line));

            if (! str_contains($line, ':')) {
                continue;
            }

            [$field, $value] = array_map('trim', explode(':', $line, 2));
            $field = strtolower($field);

            if ($field === 'user-agent') {
                if (! $isReadingAgents) {
                    $groups[] = ['agents' => [], 'rules' => []];
                    $current = array_key_last($groups);
                }

                $groups[$current]['agents'][] = strtolower($value);
                $isReadingAgents = true;

                continue;
            }

            $isReadingAgents = false;

            if ($current === null || ! in_array($field, ['allow', 'disallow'], true) || $value === '') {
                continue;
            }

            $groups[$current]['rules'][] = ['pattern' => $value, 'isAllowed' => $field === 'allow'];
        }

        return $groups;
    }
}
