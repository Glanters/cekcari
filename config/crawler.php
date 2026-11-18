<?php

return [
    'max_pages' => (int) env('CRAWLER_MAX_PAGES', 50),

    'user_agent' => env('CRAWLER_USER_AGENT', 'CekCariBot/1.0'),

    'timeout_seconds' => (int) env('CRAWLER_TIMEOUT_SECONDS', 10),

    'max_redirects' => 3,

    // Halaman lebih besar dari ini dipotong supaya satu situs tidak menghabiskan memori worker.
    'max_bytes' => 2 * 1024 * 1024,

    'max_content_chars' => 20000,

    // Jeda antar-permintaan agar crawler tidak membebani server pemilik domain.
    'delay_ms' => (int) env('CRAWLER_DELAY_MS', 500),

    // Logo situs yang lebih besar dari ini tidak disimpan; ikon situs normalnya hanya beberapa KB.
    'max_logo_bytes' => 512 * 1024,
];
