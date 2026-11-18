<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{ $seo['title'] }}</title>
        <meta name="description" content="{{ $seo['description'] }}">
        <meta name="robots" content="{{ $seo['robots'] }}">
        @if ($seo['canonical'])
            <link rel="canonical" href="{{ $seo['canonical'] }}">
        @endif
        @if (config('seo.google_site_verification'))
            <meta name="google-site-verification" content="{{ config('seo.google_site_verification') }}">
        @endif

        <meta property="og:type" content="website">
        <meta property="og:site_name" content="{{ config('seo.site_name') }}">
        <meta property="og:locale" content="id_ID">
        <meta property="og:title" content="{{ $seo['title'] }}">
        <meta property="og:description" content="{{ $seo['description'] }}">
        <meta property="og:image" content="{{ config('seo.search_url').config('seo.image_path') }}">
        @if ($seo['canonical'])
            <meta property="og:url" content="{{ $seo['canonical'] }}">
        @endif
        <meta name="twitter:card" content="summary">

        @if ($seo['structuredData'])
            {{-- JSON sudah di-encode dengan JSON_HEX_TAG di controller, aman ditaruh di dalam tag script. --}}
            <script type="application/ld+json">{!! $seo['structuredData'] !!}</script>
        @endif

        <link rel="icon" href="/favicon.ico" sizes="48x48">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <meta name="theme-color" content="#0c0a09">
        @if ($isInstallable)
            <link rel="manifest" href="/manifest.webmanifest">
            {{-- Safari iOS belum membaca semua isi manifest, jadi nama & gaya status bar ditegaskan lewat meta. --}}
            <meta name="mobile-web-app-capable" content="yes">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="apple-mobile-web-app-title" content="CekCari">
            <meta name="apple-mobile-web-app-status-bar-style" content="black">
        @endif
        @fonts
        @vite(['resources/css/app.css', $entry])
    </head>
    <body class="min-h-screen bg-canvas font-sans text-ink-900 antialiased">
        <div id="app"></div>
        <noscript>
            <p>{{ config('seo.site_name') }} membutuhkan JavaScript. Aktifkan JavaScript di browser Anda untuk mulai mencari.</p>
        </noscript>
    </body>
</html>
