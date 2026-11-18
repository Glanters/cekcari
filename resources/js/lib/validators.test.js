import { describe, expect, it } from 'vitest';
import { combine, isEmail, isOneTimeCode, isRequired, isValidSiteAddress } from './validators';

describe('validators', () => {
    it('isRequired menolak teks kosong atau spasi', () => {
        expect(isRequired('Judul')('   ')).toBe('Judul wajib diisi.');
        expect(isRequired('Judul')('Toko')).toBe(true);
    });

    it('isValidSiteAddress menerima alamat polos dan menolak skema lain', () => {
        expect(isValidSiteAddress('psms.com')).toBe(true);
        expect(isValidSiteAddress('https://contoh.com')).toBe(true);
        expect(isValidSiteAddress('ftp://contoh.com')).toBe('Isi alamat situs yang valid, misalnya psms.com.');
    });

    it('isEmail memeriksa bentuk email', () => {
        expect(isEmail('budi@contoh.id')).toBe(true);
        expect(isEmail('budi@')).not.toBe(true);
    });

    it('isOneTimeCode menerima 6 angka, termasuk yang tersalin dengan spasi', () => {
        expect(isOneTimeCode('123456')).toBe(true);
        expect(isOneTimeCode('123 456')).toBe(true);
        expect(isOneTimeCode('12345')).toBe('Kode terdiri dari 6 angka.');
        expect(isOneTimeCode('abcdef')).toBe('Kode terdiri dari 6 angka.');
    });

    it('combine mengembalikan pesan aturan pertama yang gagal', () => {
        const rule = combine(isRequired('Kode'), isOneTimeCode);

        expect(rule('')).toBe('Kode wajib diisi.');
        expect(rule('12')).toBe('Kode terdiri dari 6 angka.');
        expect(rule('654321')).toBe(true);
    });
});
