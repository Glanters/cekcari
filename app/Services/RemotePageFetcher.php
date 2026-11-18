<?php

namespace App\Services;

use App\Exceptions\RemoteFetchException;
use GuzzleHttp\Exception\TransferException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\ResponseInterface;

/**
 * Satu-satunya pintu untuk mengambil halaman dari situs milik user.
 * Redirect diikuti manual agar setiap lompatan ikut diperiksa UrlGuard.
 */
class RemotePageFetcher
{
    public function __construct(
        private readonly UrlGuard $urlGuard,
        private readonly UrlResolver $urlResolver,
    ) {}

    public function fetch(string $url): FetchedPage
    {
        $currentUrl = $this->urlResolver->normalize($url)
            ?? throw new RemoteFetchException('Alamat harus diawali http:// atau https://.');

        for ($redirectCount = 0; $redirectCount <= config('crawler.max_redirects'); $redirectCount++) {
            $target = $this->urlGuard->inspect($currentUrl);
            $response = $this->send($currentUrl, $target);

            if ($response->redirect() && $response->header('Location') !== '') {
                $nextUrl = $this->urlResolver->resolve($currentUrl, $response->header('Location'));

                if ($nextUrl === null) {
                    throw new RemoteFetchException('Situs mengalihkan ke alamat yang tidak valid.');
                }

                $currentUrl = $nextUrl;

                continue;
            }

            return new FetchedPage(
                url: $currentUrl,
                status: $response->status(),
                contentType: $response->header('Content-Type'),
                body: substr($response->body(), 0, config('crawler.max_bytes')),
            );
        }

        throw new RemoteFetchException('Situs terlalu banyak melakukan pengalihan halaman.');
    }

    /**
     * @param  array{host: string, port: int, ip: string}  $target
     */
    private function send(string $url, array $target): Response
    {
        try {
            return Http::withHeaders([
                'User-Agent' => config('crawler.user_agent'),
                'Accept' => 'text/html,application/xhtml+xml,text/plain;q=0.8',
            ])
                ->timeout(config('crawler.timeout_seconds'))
                ->connectTimeout(5)
                ->withoutRedirecting()
                ->withOptions([
                    // Mengunci koneksi ke IP yang sudah diperiksa, mencegah DNS rebinding.
                    'curl' => [CURLOPT_RESOLVE => ["{$target['host']}:{$target['port']}:{$target['ip']}"]],
                    // Halaman yang menyatakan ukurannya melebihi batas tidak diunduh sama sekali.
                    'on_headers' => function (ResponseInterface $headers) {
                        if ((int) $headers->getHeaderLine('Content-Length') > config('crawler.max_bytes')) {
                            throw new RemoteFetchException('Halaman terlalu besar untuk diproses.');
                        }
                    },
                ])
                ->get($url);
        } catch (ConnectionException|RequestException|TransferException) {
            throw new RemoteFetchException('Situs tidak dapat dihubungi atau halamannya terlalu besar. Pastikan situs aktif lalu coba lagi.');
        }
    }
}
