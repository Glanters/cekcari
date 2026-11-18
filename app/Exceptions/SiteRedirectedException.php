<?php

namespace App\Exceptions;

/**
 * Halaman yang didaftarkan ternyata mengalihkan ke domain lain, sehingga tidak ada halaman
 * di situs yang didaftarkan yang bisa dibaca.
 */
class SiteRedirectedException extends RemoteFetchException
{
    public function __construct(public readonly string $targetUrl)
    {
        parent::__construct("Link ini mengalihkan ke domain lain ({$targetUrl}).");
    }
}
