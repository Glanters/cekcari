/**
 * Kegagalan mengambil halaman situs milik user. Pesannya aman ditampilkan ke pengguna.
 */
export class RemoteFetchException extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'RemoteFetchException'
    }
}

/**
 * Halaman yang didaftarkan ternyata mengalihkan ke domain lain, sehingga tidak ada halaman
 * di situs yang didaftarkan yang bisa dibaca.
 */
export class SiteRedirectedException extends RemoteFetchException {
    constructor(readonly targetUrl: string) {
        super(`Link ini mengalihkan ke domain lain (${targetUrl}).`)
        this.name = 'SiteRedirectedException'
    }
}
