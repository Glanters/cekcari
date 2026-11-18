<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * Mengirim kerangka SPA beserta tag SEO yang dirender di server, sehingga mesin pencari
 * mendapat judul, deskripsi, canonical, dan aturan index tanpa harus menjalankan JavaScript.
 */
class SpaPageController extends Controller
{
    private const SEARCH_ENTRY = 'resources/js/search.js';

    private const PANEL_ENTRY = 'resources/js/panel.js';

    private const MAX_KEYWORD_IN_TITLE = 60;

    public function searchHome(): Response
    {
        return $this->render(self::SEARCH_ENTRY, [
            'title' => config('seo.default_title'),
            'description' => config('seo.default_description'),
            'canonical' => config('seo.search_url').'/',
            'robots' => 'index, follow',
            'structuredData' => $this->siteStructuredData(),
        ]);
    }

    // Halaman hasil pencarian internal tidak diindeks (anjuran Google), tetapi tautannya tetap boleh diikuti.
    public function searchResults(Request $request): Response
    {
        $keyword = Str::limit(trim((string) $request->query('q', '')), self::MAX_KEYWORD_IN_TITLE);

        return $this->render(self::SEARCH_ENTRY, [
            'title' => $keyword !== '' ? "{$keyword} — Hasil pencarian CekCari" : config('seo.default_title'),
            'description' => config('seo.default_description'),
            'canonical' => null,
            'robots' => 'noindex, follow',
            'structuredData' => null,
        ]);
    }

    // Alamat yang tidak dikenal di domain pencarian dijawab 404 sungguhan, bukan halaman kosong berstatus 200.
    public function searchNotFound(): Response
    {
        return $this->render(self::SEARCH_ENTRY, [
            'title' => 'Halaman tidak ditemukan — CekCari',
            'description' => config('seo.default_description'),
            'canonical' => null,
            'robots' => 'noindex, follow',
            'structuredData' => null,
        ], 404);
    }

    // Panel pemilik tidak boleh muncul di Google sama sekali.
    public function panel(): Response
    {
        return $this->render(self::PANEL_ENTRY, [
            'title' => 'Panel '.config('seo.site_name'),
            'description' => 'Panel pemilik situs '.config('seo.site_name').'.',
            'canonical' => null,
            'robots' => 'noindex, nofollow',
            'structuredData' => null,
        ])->header('X-Robots-Tag', 'noindex, nofollow');
    }

    // Data terstruktur agar Google mengenali nama situs "CekCari" beserta logonya.
    private function siteStructuredData(): string
    {
        $homeUrl = config('seo.search_url').'/';

        return json_encode([
            '@context' => 'https://schema.org',
            '@graph' => [
                ['@type' => 'WebSite', 'name' => config('seo.site_name'), 'url' => $homeUrl, 'inLanguage' => 'id-ID'],
                [
                    '@type' => 'Organization',
                    'name' => config('seo.site_name'),
                    'url' => $homeUrl,
                    'logo' => config('seo.search_url').config('seo.image_path'),
                ],
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_THROW_ON_ERROR);
    }

    /**
     * @param  array{title: string, description: string, canonical: ?string, robots: string, structuredData: ?string}  $seo
     */
    private function render(string $entry, array $seo, int $status = 200): Response
    {
        // Hanya domain pencarian yang bisa dipasang sebagai aplikasi (PWA); panel pemilik tetap situs biasa.
        return response()->view('app', [
            'entry' => $entry,
            'seo' => $seo,
            'isInstallable' => $entry === self::SEARCH_ENTRY,
        ], $status);
    }
}
