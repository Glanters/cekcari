const BLOCKED_STATUSES = [401, 403, 429, 503]

export default class FetchedPage {
    constructor(
        readonly url: string,
        readonly status: number,
        readonly contentType: string,
        readonly body: Buffer
    ) {}

    isHtml(): boolean {
        const contentType = this.contentType.toLowerCase()

        return contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    }

    isSuccessful(): boolean {
        return this.status >= 200 && this.status < 300
    }

    /**
     * Situs ada tetapi menolak pembaca otomatis, mis. tantangan bot Cloudflare (403/503)
     * atau pembatasan permintaan (429); berbeda dengan halaman yang memang tidak ada (404).
     */
    isBlocked(): boolean {
        return BLOCKED_STATUSES.includes(this.status)
    }

    // Halaman dibaca sebagai UTF-8, sama seperti perlakuan crawler versi sebelumnya.
    text(): string {
        return this.body.toString('utf8')
    }
}
