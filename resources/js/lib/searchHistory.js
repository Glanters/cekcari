// Riwayat pencarian hanya disimpan di browser pengunjung sendiri; tidak pernah dikirim ke server,
// jadi pengunjung lain tidak pernah melihat apa yang dicari orang lain.
const STORAGE_KEY = 'cekcari:search-history';
export const MAX_HISTORY_ENTRIES = 10;
export const MAX_SHOWN_ENTRIES = 6;

export function readHistory(storage) {
    try {
        const entries = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');

        return Array.isArray(entries) ? entries.filter((entry) => typeof entry === 'string' && entry.trim() !== '') : [];
    } catch {
        // Data rusak atau penyimpanan diblokir: anggap riwayat kosong.
        return [];
    }
}

function writeHistory(storage, entries) {
    try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Gagal menyimpan (mode privat/penuh) hanya berarti riwayat tidak bertambah.
        return;
    }
}

// Pencarian terbaru di depan; kata kunci yang sama (beda huruf besar/kecil) tidak diulang.
export function addToHistory(storage, keyword) {
    const trimmedKeyword = String(keyword ?? '').trim();

    if (trimmedKeyword === '') {
        return readHistory(storage);
    }

    const normalized = trimmedKeyword.toLowerCase();
    const entries = [trimmedKeyword, ...readHistory(storage).filter((entry) => entry.toLowerCase() !== normalized)].slice(
        0,
        MAX_HISTORY_ENTRIES,
    );
    writeHistory(storage, entries);

    return entries;
}

export function removeFromHistory(storage, keyword) {
    const normalized = String(keyword ?? '').toLowerCase();
    const entries = readHistory(storage).filter((entry) => entry.toLowerCase() !== normalized);
    writeHistory(storage, entries);

    return entries;
}

// Kolom kosong menampilkan pencarian terakhir; saat mengetik, hanya riwayat yang memuat ketikan itu.
export function matchHistory(entries, typedText, limit = MAX_SHOWN_ENTRIES) {
    const needle = String(typedText ?? '').trim().toLowerCase();

    return entries.filter((entry) => needle === '' || entry.toLowerCase().includes(needle)).slice(0, limit);
}
