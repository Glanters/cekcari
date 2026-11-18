<?php

namespace App\Services;

use App\Exceptions\RemoteFetchException;
use App\Exceptions\SiteRedirectedException;
use App\Models\Domain;
use App\Models\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DomainCrawler
{
    private const MAX_URL_LENGTH = 2048;

    public function __construct(
        private readonly RemotePageFetcher $fetcher,
        private readonly HtmlExtractor $extractor,
        private readonly UrlResolver $urlResolver,
    ) {}

    /**
     * Menelusuri halaman-halaman satu entri (BFS) dan menyimpan isinya. Bila link yang didaftarkan
     * punya path (mis. dkwl.b-cdn.net/latoto-kl1), hanya halaman di bawah path itu yang ditelusuri,
     * karena host yang sama bisa berisi situs milik orang lain (CDN atau hosting bersama).
     *
     * @return int jumlah halaman yang berhasil disimpan
     */
    public function crawl(Domain $domain): int
    {
        $robots = $this->loadRobotsRules($domain->url);
        $entryUrl = $this->urlResolver->normalize($domain->url);
        $queue = [$entryUrl];
        $visitedUrls = [];
        $savedUrls = [];
        $maxPages = config('crawler.max_pages');

        while ($queue !== [] && count($visitedUrls) < $maxPages) {
            $url = array_shift($queue);

            if (isset($visitedUrls[$url]) || strlen($url) > self::MAX_URL_LENGTH || ! $robots->isAllowed($url)) {
                continue;
            }

            $visitedUrls[$url] = true;
            $extracted = $this->crawlPage($domain, $url, $url === $entryUrl);

            if ($extracted === null) {
                continue;
            }

            $savedUrls[] = $extracted['url'];

            foreach ($extracted['links'] as $link) {
                if (! isset($visitedUrls[$link]) && $this->isInScope($link, $domain)) {
                    $queue[] = $link;
                }
            }

            usleep(config('crawler.delay_ms') * 1000);
        }

        if ($savedUrls === []) {
            throw new RemoteFetchException('Halaman yang didaftarkan tidak dapat dibaca oleh crawler.');
        }

        $this->removeStalePages($domain, $savedUrls);

        return count($savedUrls);
    }

    /**
     * @return array{url: string, links: list<string>}|null
     */
    private function crawlPage(Domain $domain, string $url, bool $isEntryPage): ?array
    {
        try {
            $page = $this->fetcher->fetch($url);
        } catch (RemoteFetchException $exception) {
            Log::info('Crawler melewati halaman', [
                'domain_id' => $domain->id,
                'url' => $url,
                'reason' => $exception->getMessage(),
            ]);

            return null;
        }

        // Bila halaman yang didaftarkan sendiri pindah ke domain lain, tidak ada yang bisa ditelusuri;
        // laporkan tujuannya supaya pemilik tahu alasannya, alih-alih sekadar "gagal".
        if ($isEntryPage && $page->isSuccessful() && ! $this->isSameSite($page->url, $domain->host)) {
            throw new SiteRedirectedException($page->url);
        }

        // Halaman yang didaftarkan boleh dialihkan ke mana pun di host yang sama; halaman lain harus tetap dalam cakupan.
        $isAllowedLocation = $isEntryPage || $this->isInScope($page->url, $domain);

        if (! $page->isSuccessful() || ! $page->isHtml() || ! $isAllowedLocation) {
            return null;
        }

        $extracted = $this->extractor->extract($page->body, $page->url);

        Page::updateOrCreate(['domain_id' => $domain->id, 'url' => $page->url], [
            'title' => $extracted->title ? mb_substr($extracted->title, 0, 255) : null,
            'description' => $extracted->description,
            'content' => $extracted->text,
            'http_status' => $page->status,
            'crawled_at' => now(),
        ]);

        return ['url' => $page->url, 'links' => $extracted->links];
    }

    private function loadRobotsRules(string $siteUrl): RobotsRules
    {
        try {
            // robots.txt selalu berada di akar situs, walau link yang didaftarkan menunjuk ke sub-halaman.
            $robotsPage = $this->fetcher->fetch(DomainService::originOf($siteUrl).'/robots.txt');
        } catch (RemoteFetchException) {
            return RobotsRules::allowAll();
        }

        if (! $robotsPage->isSuccessful()) {
            return RobotsRules::allowAll();
        }

        return RobotsRules::parse($robotsPage->body, config('crawler.user_agent'));
    }

    // "www.contoh.com" dan "contoh.com" dianggap situs yang sama karena umumnya saling mengalihkan.
    private function isSameSite(string $url, string $host): bool
    {
        $urlHost = strtolower((string) parse_url($url, PHP_URL_HOST));

        return preg_replace('/^www\./', '', $urlHost) === preg_replace('/^www\./', '', strtolower($host));
    }

    private function isInScope(string $url, Domain $domain): bool
    {
        if (! $this->isSameSite($url, $domain->host)) {
            return false;
        }

        $scopePath = rtrim((string) parse_url($domain->url, PHP_URL_PATH), '/');
        $path = (string) parse_url($url, PHP_URL_PATH);

        // "/latoto-kl1" mencakup "/latoto-kl1" dan "/latoto-kl1/...", tapi tidak "/latoto-kl10".
        return $scopePath === '' || $path === $scopePath || str_starts_with($path, $scopePath.'/');
    }

    /**
     * @param  list<string>  $savedUrls
     */
    private function removeStalePages(Domain $domain, array $savedUrls): void
    {
        DB::transaction(function () use ($domain, $savedUrls) {
            Page::where('domain_id', $domain->id)->whereNotIn('url', $savedUrls)->delete();
        });
    }
}
