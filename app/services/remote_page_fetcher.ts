import { inject } from '@adonisjs/core'
import { crawler } from '#config/cekcari'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'
import FetchedPage from '#services/fetched_page'
import HttpTransport from '#services/http_transport'
import UrlGuard from '#services/url_guard'
import UrlResolver from '#services/url_resolver'

/**
 * Satu-satunya pintu untuk mengambil halaman dari situs milik user.
 * Redirect diikuti manual agar setiap lompatan ikut diperiksa UrlGuard.
 */
@inject()
export default class RemotePageFetcher {
    constructor(
        private readonly urlGuard: UrlGuard,
        private readonly urlResolver: UrlResolver,
        private readonly transport: HttpTransport
    ) {}

    async fetch(url: string): Promise<FetchedPage> {
        let currentUrl = this.urlResolver.normalize(url)

        if (currentUrl === null) {
            throw new RemoteFetchException('Alamat harus diawali http:// atau https://.')
        }

        for (let redirectCount = 0; redirectCount <= crawler.maxRedirects; redirectCount++) {
            const target = await this.urlGuard.inspect(currentUrl)
            const response = await this.transport.send({
                url: currentUrl,
                ip: target.ip,
                headers: {
                    'User-Agent': crawler.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.8',
                },
                timeoutMs: crawler.timeoutSeconds * 1000,
                maxBytes: crawler.maxBytes,
            })

            if (response.status >= 300 && response.status < 400 && response.location !== '') {
                const nextUrl = this.urlResolver.resolve(currentUrl, response.location)

                if (nextUrl === null) {
                    throw new RemoteFetchException('Situs mengalihkan ke alamat yang tidak valid.')
                }

                currentUrl = nextUrl

                continue
            }

            return new FetchedPage(currentUrl, response.status, response.contentType, response.body)
        }

        throw new RemoteFetchException('Situs terlalu banyak melakukan pengalihan halaman.')
    }
}
