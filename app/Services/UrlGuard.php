<?php

namespace App\Services;

use App\Exceptions\RemoteFetchException;
use Closure;

/**
 * Mencegah server dipakai untuk mengakses jaringan internal (SSRF): setiap URL yang akan
 * diambil harus http/https, port standar, dan host-nya mengarah ke IP publik.
 */
class UrlGuard
{
    private const ALLOWED_PORTS = [80, 443];

    private Closure $resolver;

    public function __construct(?Closure $resolver = null)
    {
        $this->resolver = $resolver ?? fn (string $host): array => gethostbynamel($host) ?: [];
    }

    /**
     * @return array{host: string, port: int, ip: string}
     */
    public function inspect(string $url): array
    {
        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new RemoteFetchException('Alamat harus diawali http:// atau https://.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new RemoteFetchException('Alamat tidak boleh memuat nama pengguna atau kata sandi.');
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! in_array($port, self::ALLOWED_PORTS, true)) {
            throw new RemoteFetchException('Hanya port 80 dan 443 yang diizinkan.');
        }

        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : ($this->resolver)($host);

        if ($addresses === []) {
            throw new RemoteFetchException('Domain tidak dapat ditemukan. Periksa kembali penulisan alamatnya.');
        }

        foreach ($addresses as $address) {
            if (! $this->isPublicAddress($address)) {
                throw new RemoteFetchException('Alamat mengarah ke jaringan internal dan tidak dapat diproses.');
            }
        }

        return ['host' => $host, 'port' => $port, 'ip' => $addresses[0]];
    }

    private function isPublicAddress(string $address): bool
    {
        return filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE | FILTER_FLAG_GLOBAL_RANGE,
        ) !== false;
    }
}
