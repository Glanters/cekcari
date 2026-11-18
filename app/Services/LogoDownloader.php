<?php

namespace App\Services;

use App\Exceptions\RemoteFetchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Mengunduh ikon situs dan menyimpannya ke object storage sebagai logo domain.
 * Logo bersifat pelengkap: bila gagal, domain tetap tersimpan tanpa logo.
 */
class LogoDownloader
{
    private const DIRECTORY = 'logos';

    // SVG sengaja tidak diterima karena dapat memuat skrip.
    private const EXTENSION_BY_TYPE = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/x-icon' => 'ico',
        'image/vnd.microsoft.icon' => 'ico',
    ];

    private const ICO_SIGNATURE = "\x00\x00\x01\x00";

    public function __construct(private readonly RemotePageFetcher $fetcher) {}

    /**
     * @return string|null path logo di storage, atau null bila situs tidak punya ikon yang layak
     */
    public function download(?string $iconUrl, string $siteUrl): ?string
    {
        $candidateUrl = $iconUrl ?? DomainService::originOf($siteUrl).'/favicon.ico';

        try {
            $icon = $this->fetcher->fetch($candidateUrl);
        } catch (RemoteFetchException $exception) {
            Log::info('Ikon situs tidak dapat diunduh', ['url' => $candidateUrl, 'reason' => $exception->getMessage()]);

            return null;
        }

        $extension = $this->detectExtension($icon);

        if (! $icon->isSuccessful() || $extension === null) {
            return null;
        }

        $path = self::DIRECTORY.'/'.Str::uuid().'.'.$extension;

        if (! Storage::disk('s3')->put($path, $icon->body, 'public')) {
            Log::warning('Logo situs gagal disimpan ke object storage', ['url' => $candidateUrl]);

            return null;
        }

        return $path;
    }

    public function delete(?string $path): void
    {
        if ($path !== null && ! Storage::disk('s3')->delete($path)) {
            // Logo lama yang tertinggal hanya memakan ruang storage; tidak perlu menggagalkan proses.
            Log::warning('Logo lama gagal dihapus dari object storage', ['path' => $path]);
        }
    }

    // Jenis berkas dipastikan dari isi berkas, bukan hanya dari header yang dikirim situs.
    private function detectExtension(FetchedPage $icon): ?string
    {
        $body = $icon->body;

        if ($body === '' || strlen($body) > config('crawler.max_logo_bytes')) {
            return null;
        }

        if (str_starts_with($body, self::ICO_SIGNATURE)) {
            return 'ico';
        }

        // Berkas yang bukan gambar memicu notice PHP; hasil false sudah ditangani di bawah.
        $imageInfo = @getimagesizefromstring($body);

        return $imageInfo !== false ? (self::EXTENSION_BY_TYPE[$imageInfo['mime']] ?? null) : null;
    }
}
