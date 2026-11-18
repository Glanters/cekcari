import { isSiteAddress } from '@/lib/siteAddress';

// Validasi ringan di sisi klien demi kenyamanan; server tetap menjadi penentu akhir.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRequired(label) {
    return (value) => (String(value ?? '').trim() !== '' ? true : `${label} wajib diisi.`);
}

export function isEmail(value) {
    return EMAIL_PATTERN.test(String(value ?? '').trim()) ? true : 'Email harus berupa alamat email yang valid.';
}

export function isValidSiteAddress(value) {
    return isSiteAddress(value) ? true : 'Isi alamat situs yang valid, misalnya psms.com.';
}

// Kode dari Google Authenticator/Authy selalu 6 angka; spasi yang ikut tersalin diabaikan.
export function isOneTimeCode(value) {
    return /^\d{6}$/.test(String(value ?? '').replace(/\s/g, '')) ? true : 'Kode terdiri dari 6 angka.';
}

export function combine(...rules) {
    return (value, context) => {
        for (const rule of rules) {
            const outcome = rule(value, context);

            if (outcome !== true) {
                return outcome;
            }
        }

        return true;
    };
}
