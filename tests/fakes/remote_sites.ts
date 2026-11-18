import app from '@adonisjs/core/services/app'
import HttpTransport, {
    connectionFailure,
    type TransportRequest,
    type TransportResponse,
} from '#services/http_transport'
import UrlGuard, { type HostResolver } from '#services/url_guard'

/**
 * Situs tiruan untuk test crawler dan panel domain: tidak ada permintaan jaringan sungguhan.
 * Pola mengikuti Http::fake di versi Laravel: "*" cocok dengan apa pun dan pola tanpa skema cocok
 * dengan http maupun https. Permintaan yang tidak cocok dengan pola mana pun menggagalkan test.
 */
export type FakeResponse =
    | { status?: number; body?: string | Buffer; contentType?: string; location?: string }
    | 'failed-connection'

function patternToRegex(pattern: string): RegExp {
    const withLeadingWildcard = pattern.startsWith('*') ? pattern : `*${pattern}`
    const escaped = withLeadingWildcard
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')

    return new RegExp(`^${escaped}$`)
}

export class FakeRemoteSites extends HttpTransport {
    readonly sentUrls: string[] = []
    private readonly routes: { pattern: RegExp; response: FakeResponse }[]

    constructor(routes: Record<string, FakeResponse> = {}) {
        super()
        this.routes = Object.entries(routes).map(([pattern, response]) => ({
            pattern: patternToRegex(pattern),
            response,
        }))
    }

    async send(request: TransportRequest): Promise<TransportResponse> {
        this.sentUrls.push(request.url)
        const route = this.routes.find((candidate) => candidate.pattern.test(request.url))

        if (route === undefined) {
            throw new Error(`Permintaan tak terduga ke ${request.url}`)
        }

        if (route.response === 'failed-connection') {
            throw connectionFailure(new Error('Koneksi ditolak (tiruan)'))
        }

        return {
            status: route.response.status ?? 200,
            contentType: route.response.contentType ?? '',
            location: route.response.location ?? '',
            body: Buffer.from(route.response.body ?? ''),
        }
    }

    hasSent(predicate: (url: string) => boolean): boolean {
        return this.sentUrls.some(predicate)
    }
}


export function htmlPage(body: string): FakeResponse {
    return { status: 200, body, contentType: 'text/html; charset=utf-8' }
}

// PNG 1x1 piksel yang valid.
export const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
)

/**
 * Semua host dianggap mengarah ke IP publik agar test tidak bergantung pada DNS sungguhan.
 */
export function fakeDns(resolver: HostResolver = async () => ['93.184.216.34']) {
    app.container.swap(UrlGuard, () => new UrlGuard(resolver))
}

export function fakeRemoteSites(routes: Record<string, FakeResponse> = {}): FakeRemoteSites {
    const sites = new FakeRemoteSites(routes)
    app.container.swap(HttpTransport, () => sites)

    return sites
}


export function restoreRemoteFakes() {
    app.container.restoreAll([UrlGuard, HttpTransport])
}
