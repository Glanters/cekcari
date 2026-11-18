import { describe, expect, it } from 'vitest';
import { isSessionEnded } from './http';

function forbidden(reason) {
    return { response: { status: 403, data: { errors: reason ? { reason: [reason] } : {} } } };
}

describe('isSessionEnded', () => {
    it('mengenali sesi yang diputus server karena akun nonaktif atau IP di luar whitelist', () => {
        expect(isSessionEnded(forbidden('ip_not_allowed'))).toBe(true);
        expect(isSessionEnded(forbidden('account_inactive'))).toBe(true);
    });

    it('tidak menganggap 403 biasa sebagai sesi berakhir', () => {
        expect(isSessionEnded(forbidden())).toBe(false);
        expect(isSessionEnded({ response: { status: 401, data: {} } })).toBe(false);
        expect(isSessionEnded(new Error('Network Error'))).toBe(false);
    });
});
