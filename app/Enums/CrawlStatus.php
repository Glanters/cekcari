<?php

namespace App\Enums;

enum CrawlStatus: string
{
    case Pending = 'pending';
    case Crawling = 'crawling';
    case Done = 'done';
    case Failed = 'failed';
    // Link yang didaftarkan mengalihkan ke domain lain; crawler sengaja tidak mengikutinya.
    case Redirected = 'redirected';
}
