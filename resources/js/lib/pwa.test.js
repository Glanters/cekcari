import { describe, expect, it } from 'vitest';
import {
    DISMISS_DURATION_MS,
    installHintKind,
    isIosSafari,
    isRunningStandalone,
    rememberDismissal,
    serviceWorkerUrl,
    wasDismissedRecently,
} from './pwa';

function memoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

describe('isIosSafari', () => {
    it('mengenali Safari di iPhone', () => {
        expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    });

    it('mengabaikan browser lain di iPhone dan Android', () => {
        expect(isIosSafari(IPHONE_CHROME)).toBe(false);
        expect(isIosSafari(ANDROID_CHROME)).toBe(false);
    });
});

describe('isRunningStandalone', () => {
    it('mendeteksi aplikasi yang sudah terpasang', () => {
        expect(isRunningStandalone({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
        expect(isRunningStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
        expect(isRunningStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
    });
});

describe('installHintKind', () => {
    const base = { isStandalone: false, hasDeferredPrompt: false, isIos: false, isDismissed: false };

    it('memakai prompt asli Android bila tersedia', () => {
        expect(installHintKind({ ...base, hasDeferredPrompt: true })).toBe('prompt');
    });

    it('memberi petunjuk manual di Safari iPhone', () => {
        expect(installHintKind({ ...base, isIos: true })).toBe('ios');
    });

    it('tidak tampil di aplikasi terpasang, setelah ditutup, atau bila tidak bisa dipasang', () => {
        expect(installHintKind({ ...base, hasDeferredPrompt: true, isStandalone: true })).toBeNull();
        expect(installHintKind({ ...base, isIos: true, isDismissed: true })).toBeNull();
        expect(installHintKind(base)).toBeNull();
    });
});

describe('penutupan ajakan pasang', () => {
    it('diingat selama 30 hari', () => {
        const storage = memoryStorage();
        rememberDismissal(storage, 1000);

        expect(wasDismissedRecently(storage, 1000 + DISMISS_DURATION_MS - 1)).toBe(true);
        expect(wasDismissedRecently(storage, 1000 + DISMISS_DURATION_MS)).toBe(false);
    });

    it('aman bila penyimpanan tidak tersedia', () => {
        const brokenStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
        };

        expect(wasDismissedRecently(brokenStorage)).toBe(false);
        expect(() => rememberDismissal(brokenStorage)).not.toThrow();
    });
});

describe('serviceWorkerUrl', () => {
    it('menyertakan nama berkas build agar service worker diperbarui setiap build baru', () => {
        expect(serviceWorkerUrl('https://cekcari.com/build/assets/search-CEOc-Dir.js')).toBe('/sw.js?build=search-CEOc-Dir.js');
    });
});
