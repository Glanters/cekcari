<?php

/*
 * Aplikasi dilayani di dua domain terpisah. Isinya nama host saja, tanpa skema dan port.
 * - search: halaman pencarian publik untuk pengunjung.
 * - panel: halaman masuk/daftar dan dasbor pemilik domain.
 */
return [
    'search' => env('SEARCH_DOMAIN', 'localhost'),

    'panel' => env('PANEL_DOMAIN', 'panel.localhost'),
];
