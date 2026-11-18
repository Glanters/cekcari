<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

/**
 * robots.txt dan sitemap.xml dibuat per domain: domain pencarian terbuka untuk mesin pencari,
 * domain panel ditutup seluruhnya.
 */
class CrawlerFileController extends Controller
{
    public function searchRobots(): Response
    {
        $lines = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            '',
            'Sitemap: '.config('seo.search_url').'/sitemap.xml',
        ];

        return $this->plainText(implode("\n", $lines)."\n");
    }

    public function panelRobots(): Response
    {
        return $this->plainText("User-agent: *\nDisallow: /\n");
    }

    // Hanya beranda yang layak diindeks; halaman hasil pencarian sengaja tidak dimasukkan.
    public function searchSitemap(): Response
    {
        return response()
            ->view('sitemap', ['urls' => [config('seo.search_url').'/']])
            ->header('Content-Type', 'application/xml; charset=UTF-8');
    }

    private function plainText(string $content): Response
    {
        return response($content)->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}
