<?php

use App\Services\RobotsRules;

it('mengikuti grup wildcard dan aturan paling spesifik', function () {
    $robots = RobotsRules::parse(
        "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\nAllow: /admin/publik\nDisallow: /*.pdf$",
        'CekCariBot/1.0',
    );

    expect($robots->isAllowed('https://a.com/'))->toBeTrue()
        ->and($robots->isAllowed('https://a.com/admin/rahasia'))->toBeFalse()
        ->and($robots->isAllowed('https://a.com/admin/publik/info'))->toBeTrue()
        ->and($robots->isAllowed('https://a.com/berkas/katalog.pdf'))->toBeFalse()
        ->and($robots->isAllowed('https://a.com/berkas/katalog.pdf?v=2'))->toBeTrue();
});

it('memprioritaskan grup yang menyebut nama bot', function () {
    $robots = RobotsRules::parse("User-agent: *\nDisallow: /\n\nUser-agent: cekcaribot\nDisallow: /privat", 'CekCariBot/1.0');

    expect($robots->isAllowed('https://a.com/halaman'))->toBeTrue()
        ->and($robots->isAllowed('https://a.com/privat'))->toBeFalse();
});
