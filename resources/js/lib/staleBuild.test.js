import { describe, expect, it } from 'vitest';
import { claimReload, isStaleBuildError } from './staleBuild';

function memoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

describe('isStaleBuildError', () => {
    it('mengenali kegagalan memuat berkas halaman lama di berbagai browser', () => {
        expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: /build/assets/A.js'))).toBe(true);
        expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
        expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true);
    });

    it('mengabaikan kesalahan lain', () => {
        expect(isStaleBuildError(new Error('Request failed with status code 500'))).toBe(false);
        expect(isStaleBuildError(undefined)).toBe(false);
    });
});

describe('claimReload', () => {
    it('mengizinkan muat ulang pertama ke sebuah halaman', () => {
        expect(claimReload('/dasbor/domain', memoryStorage(), 1000)).toBe(true);
    });

    it('menolak muat ulang berulang ke halaman yang sama dalam waktu singkat', () => {
        const storage = memoryStorage();
        claimReload('/dasbor/domain', storage, 1000);

        expect(claimReload('/dasbor/domain', storage, 5000)).toBe(false);
        expect(claimReload('/dasbor/domain', storage, 20000)).toBe(true);
    });

    it('tetap mengizinkan muat ulang bila penyimpanan tidak tersedia', () => {
        const brokenStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {},
        };

        expect(claimReload('/dasbor/domain', brokenStorage, 1000)).toBe(true);
    });
});
