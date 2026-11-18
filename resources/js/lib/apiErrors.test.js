import { describe, expect, it } from 'vitest';
import { getErrorMessage, getFieldErrors } from './apiErrors';

describe('getErrorMessage', () => {
    it('memakai pesan dari server', () => {
        expect(getErrorMessage({ response: { data: { message: 'Data tidak ditemukan.' } } })).toBe('Data tidak ditemukan.');
    });

    it('memberi pesan koneksi bila server tidak menjawab', () => {
        expect(getErrorMessage(new Error('Network Error'))).toContain('koneksi internet');
    });
});

describe('getFieldErrors', () => {
    it('mengambil pesan pertama tiap field dan menggabungkan field bertitik', () => {
        const error = {
            response: {
                status: 422,
                data: { errors: { url: ['Alamat salah.', 'Lainnya'], 'tags.0': ['Tag tidak valid.'] } },
            },
        };

        expect(getFieldErrors(error)).toEqual({ url: 'Alamat salah.', tags: 'Tag tidak valid.' });
    });

    it('mengabaikan error selain 422', () => {
        expect(getFieldErrors({ response: { status: 500, data: { errors: { url: ['x'] } } } })).toEqual({});
    });
});
