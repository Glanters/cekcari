<?php

namespace App\Jobs;

use App\Enums\CrawlStatus;
use App\Exceptions\RemoteFetchException;
use App\Exceptions\SiteRedirectedException;
use App\Models\Domain;
use App\Services\DomainCrawler;
use App\Services\DomainService;
use App\Services\SiteMetadataFetcher;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dijalankan lewat antrean database (PostgreSQL), bukan Redis, karena pekerjaan ini mengubah data
 * dan dicatat ke antrean dalam transaksi yang sama dengan perubahan status domain.
 */
class CrawlDomainJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(public readonly int $domainId)
    {
        $this->onConnection('database');
    }

    public function uniqueId(): string
    {
        return (string) $this->domainId;
    }

    public function handle(DomainCrawler $crawler, SiteMetadataFetcher $metadataFetcher, DomainService $domainService): void
    {
        $domain = Domain::find($this->domainId);

        if ($domain === null) {
            return;
        }

        $domain->update(['crawl_status' => CrawlStatus::Crawling]);

        try {
            $domainService->refreshTextMetadata($domain, $metadataFetcher->fetch($domain->url, $domain->host));
            $crawler->crawl($domain);
        } catch (SiteRedirectedException $exception) {
            Log::info('Link domain mengalihkan ke domain lain', ['domain_id' => $domain->id, 'target' => $exception->targetUrl]);
            $domain->update([
                'crawl_status' => CrawlStatus::Redirected,
                'redirected_to' => mb_substr($exception->targetUrl, 0, 2048),
                'last_crawled_at' => now(),
            ]);

            return;
        } catch (RemoteFetchException $exception) {
            Log::warning('Crawl domain gagal', ['domain_id' => $domain->id, 'reason' => $exception->getMessage()]);
            $domain->update(['crawl_status' => CrawlStatus::Failed, 'redirected_to' => null, 'last_crawled_at' => now()]);

            return;
        }

        $domain->update(['crawl_status' => CrawlStatus::Done, 'redirected_to' => null, 'last_crawled_at' => now()]);
    }

    public function failed(?Throwable $exception): void
    {
        Domain::whereKey($this->domainId)->update(['crawl_status' => CrawlStatus::Failed->value]);
    }
}
