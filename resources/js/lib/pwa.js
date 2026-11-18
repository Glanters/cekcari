import { ref } from 'vue';

const DISMISS_KEY = 'cekcari:install-hint-dismissed-at';
export const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Peristiwa "beforeinstallprompt" (Android/Chrome) disimpan agar tombol "Pasang" bisa memanggilnya nanti.
export const deferredInstallPrompt = ref(null);

export function isRunningStandalone(windowObject = window) {
    return (
        windowObject.matchMedia?.('(display-mode: standalone)').matches === true ||
        windowObject.navigator?.standalone === true
    );
}

// iPhone/iPad tidak punya prompt otomatis; pemasangan hanya lewat Safari → Bagikan → Tambah ke Layar Utama.
export function isIosSafari(userAgent) {
    const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|Line\//i.test(userAgent);

    return isAppleMobile && /Safari/i.test(userAgent) && !isOtherBrowser;
}

// Membaca window.localStorage sendiri bisa melempar galat (mode privat/diblokir), jadi diamankan di sini.
export function getLocalStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function wasDismissedRecently(storage, now = Date.now()) {
    try {
        const dismissedAt = Number(storage.getItem(DISMISS_KEY));

        return Number.isFinite(dismissedAt) && dismissedAt > 0 && now - dismissedAt < DISMISS_DURATION_MS;
    } catch {
        // Penyimpanan tidak tersedia: anggap belum pernah ditutup.
        return false;
    }
}

export function rememberDismissal(storage, now = Date.now()) {
    try {
        storage.setItem(DISMISS_KEY, String(now));
    } catch {
        // Gagal menyimpan hanya berarti ajakan bisa muncul lagi di kunjungan berikutnya.
        return;
    }
}

/**
 * Menentukan jenis ajakan pasang yang ditampilkan: "prompt" (Android), "ios" (petunjuk manual), atau null.
 */
export function installHintKind({ isStandalone, hasDeferredPrompt, isIos, isDismissed }) {
    if (isStandalone || isDismissed) {
        return null;
    }

    if (hasDeferredPrompt) {
        return 'prompt';
    }

    return isIos ? 'ios' : null;
}

// Nama berkas build ber-hash berubah setiap kali kode berubah. Menyertakannya di alamat service worker
// membuat browser memasang ulang service worker, sehingga kode terbaru ikut disimpan untuk dipakai offline.
export function serviceWorkerUrl(moduleUrl = import.meta.url) {
    const buildVersion = new URL(moduleUrl).pathname.split('/').pop();

    return `/sw.js?build=${encodeURIComponent(buildVersion)}`;
}

// Service worker langsung mengunduh seluruh kode aplikasi untuk offline. Dipasang saat browser
// senggang supaya unduhan itu tidak berebut jaringan dengan halaman yang sedang dibuka pengunjung.
const IDLE_FALLBACK_MS = 3000;

function whenIdle(callback) {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: IDLE_FALLBACK_MS });

        return;
    }

    window.setTimeout(callback, IDLE_FALLBACK_MS);
}

function registerServiceWorker() {
    navigator.serviceWorker.register(serviceWorkerUrl()).catch(() => {
        // Tanpa service worker situs tetap berjalan normal, hanya tidak bisa dipakai offline.
        return null;
    });
}

export function setupPwa() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt.value = event;
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt.value = null;
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => whenIdle(registerServiceWorker));
    }
}
