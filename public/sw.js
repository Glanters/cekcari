// Service worker CekCari (domain pencarian).
// - Halaman: ambil dari jaringan dulu; bila offline, tampilkan versi terakhir yang tersimpan.
// - Berkas statis ber-hash (/build, ikon): ambil dari cache dulu karena isinya tidak pernah berubah.
//   Seluruh kode aplikasi pencarian disimpan sejak dipasang (dibaca dari manifest build Vite), sehingga
//   beranda tetap terbuka offline walau pengunjung baru sekali membuka satu halaman.
//   Halaman memuat service worker ini dengan ?build=<versi>, jadi setiap build baru memicu pemasangan ulang.
// - API pencarian: selalu dari jaringan, tidak pernah disimpan, supaya hasil selalu terbaru.
// Naikkan CACHE_VERSION bila strategi cache berubah; cache lama dihapus saat service worker baru aktif.

const CACHE_VERSION = 'v1';
const PAGE_CACHE = `cekcari-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `cekcari-assets-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_URL = '/';
const BUILD_MANIFEST_URL = '/build/manifest.json';
const APP_ENTRIES = ['resources/js/search.js', 'resources/css/app.css'];

const PRECACHE_URLS = [
    '/',
    '/manifest.webmanifest',
    '/images/brand/cekcari-logo-128.png',
    '/images/brand/cekcari-logo-256.png',
    '/favicon-32x32.png',
];

// Menelusuri entri aplikasi pencarian beserta semua import & import dinamis (halaman lazy) di manifest Vite.
function collectBuildFiles(manifest) {
    const files = new Set();
    const visited = new Set();
    const queue = [...APP_ENTRIES];

    while (queue.length > 0) {
        const key = queue.shift();
        const chunk = manifest[key];

        if (!chunk || visited.has(key)) {
            continue;
        }

        visited.add(key);
        files.add(`/build/${chunk.file}`);
        [...(chunk.css ?? []), ...(chunk.assets ?? [])].forEach((file) => files.add(`/build/${file}`));
        queue.push(...(chunk.imports ?? []), ...(chunk.dynamicImports ?? []));
    }

    // Font dari direktif @fonts tidak terhubung ke entri; cukup format woff2 yang didukung semua browser modern.
    Object.values(manifest)
        .filter((chunk) => chunk.file.endsWith('.woff2'))
        .forEach((chunk) => files.add(`/build/${chunk.file}`));

    return files;
}

async function precacheBuild() {
    let manifest;

    try {
        const response = await fetch(BUILD_MANIFEST_URL, { cache: 'no-store' });

        if (!response.ok) {
            return;
        }

        manifest = await response.json();
    } catch {
        // Tanpa manifest (mis. mode pengembangan Vite) berkas tetap disimpan satu per satu saat dibuka.
        return;
    }

    const buildFiles = collectBuildFiles(manifest);
    const cache = await caches.open(ASSET_CACHE);
    await cache.addAll([...buildFiles]);

    // Berkas build lama tidak dipakai lagi oleh versi ini; dibuang agar penyimpanan tidak menumpuk.
    const cachedRequests = await cache.keys();
    await Promise.all(
        cachedRequests
            .filter((request) => {
                const { pathname } = new URL(request.url);

                return pathname.startsWith('/build/') && !buildFiles.has(pathname);
            })
            .map((request) => cache.delete(request)),
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(PAGE_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(precacheBuild)
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    const currentCaches = [PAGE_CACHE, ASSET_CACHE];

    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName.startsWith('cekcari-') && !currentCaches.includes(cacheName))
                        .map((cacheName) => caches.delete(cacheName)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

function isStaticAsset(url) {
    return (
        url.pathname.startsWith('/build/') ||
        url.pathname.startsWith('/images/brand/') ||
        /^\/favicon|^\/apple-touch-icon/.test(url.pathname)
    );
}

async function cacheFirst(request) {
    const cached = await caches.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);

    if (response.ok) {
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(request, response.clone());
    }

    return response;
}

async function networkFirstPage(request) {
    try {
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(request, response.clone());
        }

        return response;
    } catch (networkError) {
        const cached = (await caches.match(request)) ?? (await caches.match(OFFLINE_FALLBACK_URL));

        if (cached) {
            return cached;
        }

        throw networkError;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Hanya permintaan GET ke domain ini yang ditangani; selebihnya (API, logo situs dari storage, dll.) apa adanya.
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstPage(request));

        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
    }
});
