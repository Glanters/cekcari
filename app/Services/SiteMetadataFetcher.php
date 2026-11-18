<?php

namespace App\Services;

use App\Exceptions\RemoteFetchException;

/**
 * Mengambil identitas situs (judul, deskripsi, tag, ikon) dari halaman yang didaftarkan,
 * karena pemilik domain hanya mengisi link.
 */
class SiteMetadataFetcher
{
    public const MAX_TITLE_LENGTH = 120;

    public const MAX_DESCRIPTION_LENGTH = 1000;

    public const MAX_TAGS = 10;

    private const MAX_TAG_LENGTH = 40;

    // Panjang cuplikan isi halaman bila situs tidak punya meta description.
    private const FALLBACK_DESCRIPTION_LENGTH = 300;

    public function __construct(
        private readonly RemotePageFetcher $fetcher,
        private readonly HtmlExtractor $extractor,
    ) {}

    public function fetch(string $siteUrl, string $host): SiteMetadata
    {
        $page = $this->fetcher->fetch($siteUrl);

        if (! $page->isSuccessful()) {
            throw new RemoteFetchException("Situs tidak dapat dibuka (kode {$page->status}). Pastikan link benar dan situs sedang aktif.");
        }

        if (! $page->isHtml()) {
            throw new RemoteFetchException('Link tidak mengarah ke halaman web. Isi dengan alamat halaman situs, misalnya psms.id.');
        }

        $extracted = $this->extractor->extract($page->body, $page->url);

        return new SiteMetadata(
            title: mb_substr($extracted->title ?? $host, 0, self::MAX_TITLE_LENGTH),
            description: $this->description($extracted),
            tags: $this->tags($extracted->keywords),
            iconUrl: $extracted->iconUrl,
        );
    }

    private function description(ExtractedHtml $extracted): string
    {
        if ($extracted->description !== null) {
            return mb_substr($extracted->description, 0, self::MAX_DESCRIPTION_LENGTH);
        }

        if (mb_strlen($extracted->text) <= self::FALLBACK_DESCRIPTION_LENGTH) {
            return $extracted->text;
        }

        return rtrim(mb_substr($extracted->text, 0, self::FALLBACK_DESCRIPTION_LENGTH)).'…';
    }

    /**
     * Hanya kata kunci yang layak dijadikan tag: diawali huruf/angka dan tidak terlalu panjang.
     *
     * @param  list<string>  $keywords
     * @return list<string>
     */
    private function tags(array $keywords): array
    {
        $validKeywords = array_filter(
            $keywords,
            fn (string $keyword) => mb_strlen($keyword) <= self::MAX_TAG_LENGTH
                && preg_match('/^[\pL\pN][\pL\pN\s\-]*$/u', $keyword) === 1,
        );

        return array_slice(array_values($validKeywords), 0, self::MAX_TAGS);
    }
}
