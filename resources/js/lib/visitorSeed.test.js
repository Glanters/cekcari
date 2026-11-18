import { describe, expect, it } from 'vitest';
import { SEED_LIFETIME_MS, getVisitorSeed } from './visitorSeed';

function memoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

describe('getVisitorSeed', () => {
    it('membuat seed bilangan bulat positif', () => {
        const seed = getVisitorSeed(memoryStorage(), 1000);

        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThan(0);
    });

    it('memakai seed yang sama selama masa berlakunya', () => {
        const storage = memoryStorage();
        const firstSeed = getVisitorSeed(storage, 1000);

        expect(getVisitorSeed(storage, 1000 + SEED_LIFETIME_MS - 1)).toBe(firstSeed);
    });

    it('membuat seed baru setelah masa berlakunya habis', () => {
        const storage = memoryStorage();
        storage.setItem('cekcari:visitor-seed', JSON.stringify({ seed: 42, createdAt: 1000 }));

        expect(getVisitorSeed(storage, 1000 + SEED_LIFETIME_MS)).not.toBe(42);
    });

    it('tetap memberi seed yang stabil bila penyimpanan tidak tersedia', () => {
        const brokenStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {},
        };

        const seed = getVisitorSeed(brokenStorage, 1000);

        expect(getVisitorSeed(brokenStorage, 2000)).toBe(seed);
    });
});
