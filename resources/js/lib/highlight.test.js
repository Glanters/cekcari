import { describe, expect, it } from 'vitest';
import { splitHighlightedText } from './highlight';

const START = '⟦';
const END = '⟧';

describe('splitHighlightedText', () => {
    it('memisahkan teks biasa dan teks bersorot', () => {
        expect(splitHighlightedText(`Wajan ${START}keramik${END} anti lengket`, START, END)).toEqual([
            { text: 'Wajan ', isHighlighted: false },
            { text: 'keramik', isHighlighted: true },
            { text: ' anti lengket', isHighlighted: false },
        ]);
    });

    it('menggabungkan sorotan yang bersebelahan', () => {
        expect(splitHighlightedText(`${START}kopi${END}${START} susu${END}`, START, END)).toEqual([
            { text: 'kopi susu', isHighlighted: true },
        ]);
    });

    it('memperlakukan html sebagai teks biasa', () => {
        const segments = splitHighlightedText(`<img src=x onerror=alert(1)> ${START}aman${END}`, START, END);

        expect(segments[0]).toEqual({ text: '<img src=x onerror=alert(1)> ', isHighlighted: false });
    });

    it('membuang penanda yang tidak berpasangan', () => {
        expect(splitHighlightedText(`awal ${START}tanpa akhir`, START, END)).toEqual([
            { text: 'awal tanpa akhir', isHighlighted: false },
        ]);
    });

    it('mengembalikan daftar kosong untuk teks kosong', () => {
        expect(splitHighlightedText(null, START, END)).toEqual([]);
    });
});
