import { describe, expect, it } from 'vitest';
import { getVisitorId } from './analytics';

function memoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

const FIRST_ID = '11111111-2222-4333-8444-555555555555';
const SECOND_ID = '66666666-7777-4888-9999-000000000000';

describe('ID pengunjung', () => {
    it('dibuat sekali lalu dipakai ulang di kunjungan berikutnya', () => {
        const storage = memoryStorage();
        const ids = [FIRST_ID, SECOND_ID];

        expect(getVisitorId(storage, () => ids.shift())).toBe(FIRST_ID);
        expect(getVisitorId(storage, () => ids.shift())).toBe(FIRST_ID);
    });

    it('diganti bila isi penyimpanan bukan UUID', () => {
        const storage = memoryStorage();
        storage.setItem('cekcari:visitor-id', 'rusak');

        expect(getVisitorId(storage, () => SECOND_ID)).toBe(SECOND_ID);
    });

    it('tetap memberi ID bila penyimpanan diblokir', () => {
        const blockedStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
        };

        expect(getVisitorId(blockedStorage, () => FIRST_ID)).toBe(FIRST_ID);
        expect(getVisitorId(null, () => SECOND_ID)).toBe(SECOND_ID);
    });
});
