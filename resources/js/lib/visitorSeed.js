// Angka acak milik pengunjung untuk mengacak urutan hasil pencarian. Seed yang sama dipakai
// selama 30 menit supaya pindah halaman 2, 3, dst. tetap konsisten, lalu diganti agar urutannya bergilir.

const SEED_KEY = 'cekcari:visitor-seed';
export const SEED_LIFETIME_MS = 30 * 60 * 1000;
const MAX_SEED = 2147483647;

function createSeed() {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);

    return (randomValues[0] % MAX_SEED) + 1;
}

// Cadangan bila sessionStorage tidak bisa dipakai (mode privat/diblokir).
let fallbackSeed = null;

export function getVisitorSeed(storage, now = Date.now()) {
    try {
        const stored = JSON.parse(storage.getItem(SEED_KEY) ?? 'null');

        if (stored && Number.isInteger(stored.seed) && now - stored.createdAt < SEED_LIFETIME_MS) {
            return stored.seed;
        }

        const seed = createSeed();
        storage.setItem(SEED_KEY, JSON.stringify({ seed, createdAt: now }));

        return seed;
    } catch {
        fallbackSeed ??= createSeed();

        return fallbackSeed;
    }
}
