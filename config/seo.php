<?php

return [
    'site_name' => env('APP_NAME', 'CekCari'),

    // Alamat publik domain pencarian, dipakai untuk canonical, sitemap, dan Open Graph.
    // Production: https://cekcari.com
    'search_url' => rtrim((string) env('SEARCH_URL', 'http://localhost:8000'), '/'),

    'default_title' => 'CekCari — Mesin Pencari Situs dan Halaman Web Indonesia',

    'default_description' => 'Cari situs dan halaman web Indonesia dengan cepat di CekCari. Ketik kata kunci, '
        .'temukan situs yang relevan beserta halaman-halaman di dalamnya.',

    'image_path' => '/images/brand/cekcari-logo-512.png',

    // Kode verifikasi Google Search Console (meta tag "google-site-verification"); kosongkan bila tidak dipakai.
    'google_site_verification' => env('GOOGLE_SITE_VERIFICATION'),
];
