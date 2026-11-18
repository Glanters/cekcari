<?php

namespace App\Services;

use App\Enums\CrawlStatus;
use App\Exceptions\RemoteFetchException;
use App\Jobs\CrawlDomainJob;
use App\Models\Domain;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class DomainService
{
    public function __construct(
        private readonly SiteMetadataFetcher $metadataFetcher,
        private readonly LogoDownloader $logoDownloader,
    ) {}

    /**
     * Pemilik cukup mengisi link (boleh dengan path): judul, deskripsi, tag, dan logo diambil dari halaman itu,
     * lalu crawl pertama dijadwalkan dalam transaksi yang sama.
     */
    public function create(User $owner, string $url): Domain
    {
        [$siteUrl, $metadata] = $this->fetchReachableSite($url);
        $logoPath = $this->logoDownloader->download($metadata->iconUrl, $siteUrl);

        try {
            return DB::transaction(function () use ($owner, $url, $siteUrl, $metadata, $logoPath) {
                $domain = Domain::create([
                    'user_id' => $owner->id,
                    'url' => $siteUrl,
                    'host' => self::hostOf($url),
                    'title' => $metadata->title,
                    'description' => $metadata->description,
                    'logo_path' => $logoPath,
                    'crawl_status' => CrawlStatus::Pending,
                    'created_by' => $owner->id,
                    'updated_by' => $owner->id,
                ]);

                $this->syncTags($domain, $metadata->tags);
                CrawlDomainJob::dispatch($domain->id);

                return $domain;
            });
        } catch (Throwable $exception) {
            $this->logoDownloader->delete($logoPath);

            throw $exception;
        }
    }

    /**
     * Mengganti link: data situs diambil ulang, halaman lama dibuang bila link berubah,
     * dan crawl dijadwalkan ulang.
     */
    public function update(Domain $domain, User $editor, string $url): Domain
    {
        [$siteUrl, $metadata] = $this->fetchReachableSite($url);
        $newLogoPath = $this->logoDownloader->download($metadata->iconUrl, $siteUrl);
        $oldLogoPath = $domain->logo_path;
        // Link berbeda berarti cakupan crawl berbeda, jadi halaman lama tidak berlaku lagi.
        $isLinkChanged = self::addressOf($url) !== self::addressOf($domain->url);

        try {
            DB::transaction(function () use ($domain, $editor, $url, $siteUrl, $metadata, $newLogoPath, $isLinkChanged) {
                $domain->update([
                    'url' => $siteUrl,
                    'host' => self::hostOf($url),
                    'title' => $metadata->title,
                    'description' => $metadata->description,
                    'logo_path' => $newLogoPath,
                    'crawl_status' => CrawlStatus::Pending,
                    'last_crawled_at' => $isLinkChanged ? null : $domain->last_crawled_at,
                    'updated_by' => $editor->id,
                ]);

                if ($isLinkChanged) {
                    $domain->pages()->delete();
                }

                $this->syncTags($domain, $metadata->tags);
                CrawlDomainJob::dispatch($domain->id);
            });
        } catch (Throwable $exception) {
            $this->logoDownloader->delete($newLogoPath);

            throw $exception;
        }

        $this->logoDownloader->delete($oldLogoPath);

        return $domain;
    }

    /**
     * Dipakai crawler agar judul, deskripsi, dan tag mengikuti perubahan di situs pemilik.
     */
    public function refreshTextMetadata(Domain $domain, SiteMetadata $metadata): void
    {
        DB::transaction(function () use ($domain, $metadata) {
            $domain->update(['title' => $metadata->title, 'description' => $metadata->description]);
            $this->syncTags($domain, $metadata->tags);
        });
    }

    public function delete(Domain $domain, User $editor): void
    {
        DB::transaction(function () use ($domain, $editor) {
            $domain->update(['updated_by' => $editor->id]);
            $domain->delete();
        });
    }

    public function requestCrawl(Domain $domain, User $editor): Domain
    {
        if (in_array($domain->crawl_status, [CrawlStatus::Pending, CrawlStatus::Crawling], true)) {
            throw ValidationException::withMessages([
                'crawl' => 'Pembaruan data untuk domain ini sedang berjalan. Tunggu hingga selesai.',
            ]);
        }

        return DB::transaction(function () use ($domain, $editor) {
            $domain->update(['crawl_status' => CrawlStatus::Pending, 'updated_by' => $editor->id]);
            CrawlDomainJob::dispatch($domain->id);

            return $domain;
        });
    }

    public static function hostOf(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_HOST));
    }

    public static function originOf(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_SCHEME)).'://'.self::hostOf($url);
    }

    /**
     * Link yang disimpan apa adanya beserta path-nya (mis. "https://psms.id/players"), tanpa fragmen
     * dan tanpa garis miring penutup, supaya hasil pencarian mengarah ke halaman yang didaftarkan pemilik.
     */
    public static function entryUrlOf(string $url): string
    {
        $path = rtrim((string) parse_url($url, PHP_URL_PATH), '/');
        $query = (string) parse_url($url, PHP_URL_QUERY);

        return self::originOf($url).$path.($query !== '' ? '?'.$query : '');
    }

    /**
     * Alamat pembanding keunikan: link tanpa skema, sehingga http://x/a dan https://x/a dianggap sama.
     */
    public static function addressOf(string $url): string
    {
        return explode('://', self::entryUrlOf($url), 2)[1];
    }

    /**
     * Membaca halaman yang didaftarkan. Alamat dicoba lewat https lebih dulu; bila situs
     * hanya melayani http, alamat http yang dipakai dan disimpan.
     *
     * @return array{0: string, 1: SiteMetadata}
     */
    private function fetchReachableSite(string $url): array
    {
        $host = self::hostOf($url);
        $siteUrl = self::entryUrlOf($url);

        try {
            return [$siteUrl, $this->metadataFetcher->fetch($siteUrl, $host)];
        } catch (RemoteFetchException $httpsFailure) {
            if (! str_starts_with($siteUrl, 'https://')) {
                throw $httpsFailure;
            }

            $httpUrl = 'http://'.substr($siteUrl, strlen('https://'));

            try {
                return [$httpUrl, $this->metadataFetcher->fetch($httpUrl, $host)];
            } catch (RemoteFetchException) {
                // Pesan kegagalan https lebih relevan bagi pemilik, karena itu alamat yang ia isi.
                throw $httpsFailure;
            }
        }
    }

    /**
     * @param  list<string>  $tagNames
     */
    private function syncTags(Domain $domain, array $tagNames): void
    {
        $tagIds = collect($tagNames)
            ->map(fn (string $name) => mb_strtolower(trim($name)))
            ->filter(fn (string $name) => Str::slug($name) !== '')
            ->unique(fn (string $name) => Str::slug($name))
            ->map(fn (string $name) => Tag::createOrFirst(['slug' => Str::slug($name)], ['name' => $name])->id)
            ->values()
            ->all();

        $domain->tags()->sync($tagIds);
    }
}
