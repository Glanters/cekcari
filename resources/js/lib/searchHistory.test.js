import { describe, expect, it } from 'vitest';
import { MAX_HISTORY_ENTRIES, addToHistory, matchHistory, readHistory, removeFromHistory } from './searchHistory';

function memoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

describe('riwayat pencarian', () => {
    it('menaruh pencarian terbaru di depan tanpa mengulang kata kunci yang sama', () => {
        const storage = memoryStorage();
        addToHistory(storage, 'kopi');
        addToHistory(storage, 'teh');
        addToHistory(storage, ' KOPI ');

        expect(readHistory(storage)).toEqual(['KOPI', 'teh']);
    });

    it('membatasi jumlah riwayat dan mengabaikan kata kunci kosong', () => {
        const storage = memoryStorage();

        for (let index = 1; index <= MAX_HISTORY_ENTRIES + 3; index++) {
            addToHistory(storage, `kata ${index}`);
        }
        addToHistory(storage, '   ');

        expect(readHistory(storage)).toHaveLength(MAX_HISTORY_ENTRIES);
        expect(readHistory(storage)[0]).toBe(`kata ${MAX_HISTORY_ENTRIES + 3}`);
    });

    it('menghapus satu entri riwayat', () => {
        const storage = memoryStorage();
        addToHistory(storage, 'kopi');
        addToHistory(storage, 'teh');

        expect(removeFromHistory(storage, 'KOPI')).toEqual(['teh']);
    });

    it('mencocokkan riwayat dengan ketikan, atau menampilkan yang terbaru saat kolom kosong', () => {
        const entries = ['kopi susu', 'teh manis', 'Kopi hitam'];

        expect(matchHistory(entries, 'kop')).toEqual(['kopi susu', 'Kopi hitam']);
        expect(matchHistory(entries, '')).toEqual(entries);
        expect(matchHistory(entries, '', 2)).toEqual(['kopi susu', 'teh manis']);
    });

    it('aman bila penyimpanan rusak atau tidak tersedia', () => {
        const brokenStorage = {
            getItem: () => '{bukan json',
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        };

        expect(readHistory(brokenStorage)).toEqual([]);
        expect(addToHistory(brokenStorage, 'kopi')).toEqual(['kopi']);
        expect(readHistory(null)).toEqual([]);
    });
});
