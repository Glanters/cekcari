export const MAX_SITES_PER_BATCH = 20;

// Alamat situs boleh polos ("psms.com") atau lengkap ("https://psms.com/beranda").
const SITE_ADDRESS_PATTERN = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

export function isSiteAddress(value) {
    return SITE_ADDRESS_PATTERN.test(String(value ?? '').trim());
}

export function hostOf(address) {
    return address
        .replace(/^https?:\/\//i, '')
        .split(/[/:?#]/)[0]
        .toLowerCase();
}

/**
 * Kunci pembanding link ganda dalam satu tempelan, sama dengan aturan server: host (huruf kecil)
 * + path tanpa garis miring penutup, tanpa skema. "psms.com" dan "https://psms.com/" dianggap sama,
 * sedangkan "x.b-cdn.net/a" dan "x.b-cdn.net/b" berbeda.
 */
export function addressKeyOf(address) {
    const withoutScheme = address.replace(/^https?:\/\//i, '').split('#')[0];
    const slashIndex = withoutScheme.indexOf('/');
    const host = (slashIndex === -1 ? withoutScheme : withoutScheme.slice(0, slashIndex)).toLowerCase();
    const rest = slashIndex === -1 ? '' : withoutScheme.slice(slashIndex);
    const [path, query] = rest.split('?');

    return host + path.replace(/\/+$/, '') + (query ? `?${query}` : '');
}

/**
 * Memecah link tersimpan menjadi bagian yang ditampilkan berbeda gaya,
 * mis. "https://psms.id/players" → { scheme: "https://", host: "psms.id", path: "/players" }.
 */
export function splitSiteUrl(url) {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/$/, '');

    return {
        scheme: `${parsedUrl.protocol}//`,
        host: parsedUrl.host,
        path: path + parsedUrl.search,
    };
}

/**
 * Memecah teks tempelan (dipisah baris baru, spasi, koma, atau titik koma) menjadi daftar alamat unik.
 *
 * @returns {{ address: string, host: string, isValid: boolean }[]}
 */
export function parseSiteAddresses(text) {
    const seenKeys = new Set();

    return String(text ?? '')
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((address) => ({ address, host: hostOf(address), isValid: isSiteAddress(address) }))
        .filter((entry) => {
            const key = entry.isValid ? addressKeyOf(entry.address) : entry.address;

            if (seenKeys.has(key)) {
                return false;
            }

            seenKeys.add(key);

            return true;
        });
}
