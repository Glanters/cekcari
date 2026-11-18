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

    // Halaman dibaca sebagai UTF-8, sama seperti perlakuan crawler versi sebelumnya.
    text(): string {
        return this.body.toString('utf8')
    }
}
