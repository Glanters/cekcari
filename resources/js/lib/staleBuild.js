// Setelah aplikasi diperbarui (build baru), tab yang masih terbuka merujuk ke berkas halaman lama
// yang sudah tidak ada. Perpindahan halaman lalu gagal diam-diam, misalnya tetap di halaman masuk
// walau login berhasil. Solusinya: muat ulang penuh ke halaman tujuan, sekali saja.

const RELOAD_MARKER_KEY = 'cekcari:stale-build-reload';
const RELOAD_GUARD_MS = 10000;

const CHUNK_ERROR_PATTERN =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isStaleBuildError(error) {
    return CHUNK_ERROR_PATTERN.test(String(error?.message ?? error ?? ''));
}

/**
 * Mencatat bahwa halaman ini akan dimuat ulang. Bila tujuan yang sama baru saja dimuat ulang
 * dan tetap gagal, kembalikan false agar tidak terjadi muat ulang tanpa henti.
 */
export function claimReload(path, storage, now = Date.now()) {
    try {
        const previous = JSON.parse(storage.getItem(RELOAD_MARKER_KEY) ?? 'null');

        if (previous?.path === path && now - previous.at < RELOAD_GUARD_MS) {
            return false;
        }

        storage.setItem(RELOAD_MARKER_KEY, JSON.stringify({ path, at: now }));

        return true;
    } catch {
        // Penyimpanan sesi tidak tersedia (mode privat/diblokir): tetap izinkan satu kali muat ulang.
        return true;
    }
}

export function installStaleBuildRecovery(router) {
    router.onError((error, to) => {
        if (to && isStaleBuildError(error) && claimReload(to.fullPath, window.sessionStorage)) {
            window.location.assign(to.fullPath);
        }
    });

    window.addEventListener('vite:preloadError', (event) => {
        const currentPath = window.location.pathname + window.location.search;

        if (claimReload(currentPath, window.sessionStorage)) {
            event.preventDefault();
            window.location.reload();
        }
    });
}
