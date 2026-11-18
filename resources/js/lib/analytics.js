// Statistik pengunjung CekCari. Setiap browser mendapat ID acak sendiri (bukan data pribadi);
// server hanya menyimpan hash-nya. Data dikirim dengan sendBeacon agar tidak menunda halaman
// atau perpindahan ke situs yang diklik.
const VISITOR_ID_KEY = 'cekcari:visitor-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getVisitorId(storage, createId = () => crypto.randomUUID()) {
    try {
        const storedId = storage?.getItem(VISITOR_ID_KEY);

        if (storedId && UUID_PATTERN.test(storedId)) {
            return storedId;
        }

        const newId = createId();
        storage?.setItem(VISITOR_ID_KEY, newId);

        return newId;
    } catch {
        // Penyimpanan diblokir (mode privat): kunjungan tetap dihitung, hanya tidak bisa dikenali ulang.
        return createId();
    }
}

function send(path, payload) {
    const body = JSON.stringify(payload);

    try {
        if (navigator.sendBeacon?.(path, new Blob([body], { type: 'application/json' }))) {
            return;
        }

        fetch(path, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(
            () => null,
        );
    } catch {
        // Statistik hanya pelengkap; kegagalan mengirim tidak boleh mengganggu pengunjung.
        return;
    }
}

export function trackVisit(storage) {
    send('/api/v1/visits', { visitor_id: getVisitorId(storage) });
}

export function trackDomainClick(storage, domainId, isPromoted) {
    send('/api/v1/domain-clicks', { visitor_id: getVisitorId(storage), domain_id: domainId, is_promoted: isPromoted });
}
