<?php

namespace App\Console\Commands;

use App\Enums\CrawlStatus;
use App\Jobs\CrawlDomainJob;
use App\Models\Domain;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecrawlDomains extends Command
{
    private const RECRAWL_AFTER_DAYS = 7;

    protected $signature = 'domains:recrawl';

    protected $description = 'Menjadwalkan crawl ulang untuk domain yang datanya sudah lama';

    public function handle(): int
    {
        $scheduledCount = 0;

        Domain::query()
            ->whereNotIn('crawl_status', [CrawlStatus::Pending->value, CrawlStatus::Crawling->value])
            ->where(fn ($query) => $query
                ->whereNull('last_crawled_at')
                ->orWhere('last_crawled_at', '<', now()->subDays(self::RECRAWL_AFTER_DAYS)))
            ->chunkById(100, function ($domains) use (&$scheduledCount) {
                foreach ($domains as $domain) {
                    DB::transaction(function () use ($domain) {
                        $domain->update(['crawl_status' => CrawlStatus::Pending]);
                        CrawlDomainJob::dispatch($domain->id);
                    });
                    $scheduledCount++;
                }
            });

        $this->info("{$scheduledCount} domain dijadwalkan untuk crawl ulang.");

        return self::SUCCESS;
    }
}
