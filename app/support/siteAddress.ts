/**
 * Bentuk-bentuk alamat situs yang didaftarkan pemilik. Semua fungsi menerima URL yang sudah lolos validasi.
 */
export function hostOf(url: string): string {
    return new URL(url).hostname.toLowerCase()
}

export function originOf(url: string): string {
    return `${new URL(url).protocol.toLowerCase()}//${hostOf(url)}`
}

/**
 * Link yang disimpan apa adanya beserta path-nya (mis. "https://psms.id/players"), tanpa fragmen
 * dan tanpa garis miring penutup, supaya hasil pencarian mengarah ke halaman yang didaftarkan pemilik.
 */
export function entryUrlOf(url: string): string {
    const parsed = new URL(url)

    return `${originOf(url)}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`
}

/**
 * Apakah url masih berada di situs yang didaftarkan; "www." dianggap situs yang sama.
 * Menerima url apa pun (mis. tujuan redirect), jadi url yang tidak valid dianggap situs lain.
 */
export function isSameSite(url: string, host: string): boolean {
    const urlHost = (URL.parse(url)?.hostname ?? '').toLowerCase().replace(/^www\./, '')

    return urlHost === host.toLowerCase().replace(/^www\./, '')
}

/**
 * Alamat pembanding keunikan: link tanpa skema, sehingga http://x/a dan https://x/a dianggap sama.
 * Harus sama dengan ekspresi indeks unik domains_address_unique.
 */
export function addressOf(url: string): string {
    const entryUrl = entryUrlOf(url)

    return entryUrl.slice(entryUrl.indexOf('://') + 3)
}
