<?php

use App\Exceptions\RemoteFetchException;
use App\Services\UrlGuard;

it('mengizinkan host yang mengarah ke ip publik', function () {
    $guard = new UrlGuard(fn (): array => ['93.184.216.34']);

    expect($guard->inspect('https://tokoku.com/x'))->toBe(['host' => 'tokoku.com', 'port' => 443, 'ip' => '93.184.216.34']);
});

it('menolak url yang tidak aman', function (string $url) {
    $guard = new UrlGuard(fn (): array => ['93.184.216.34']);

    expect(fn () => $guard->inspect($url))->toThrow(RemoteFetchException::class);
})->with([
    'skema file' => 'file:///etc/passwd',
    'port tidak standar' => 'https://tokoku.com:8080/',
    'kredensial di url' => 'https://user:pass@tokoku.com/',
    'ip loopback langsung' => 'http://127.0.0.1/',
    'metadata cloud' => 'http://169.254.169.254/latest/meta-data',
]);

it('menolak host yang tidak dapat di-resolve', function () {
    expect(fn () => (new UrlGuard(fn (): array => []))->inspect('https://tidak-ada.test'))
        ->toThrow(RemoteFetchException::class, 'Domain tidak dapat ditemukan');
});
