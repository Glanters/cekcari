import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { RemoteFetchException } from '#exceptions/remote_fetch_exception'

export type TransportRequest = {
    url: string
    // IP yang sudah lolos pemeriksaan UrlGuard; koneksi wajib menuju alamat ini.
    ip: string
    headers: Record<string, string>
    timeoutMs: number
    maxBytes: number
}

export type TransportResponse = {
    status: number
    contentType: string
    location: string
    body: Buffer
}

export function connectionFailure(cause?: unknown): RemoteFetchException {
    return new RemoteFetchException(
        'Situs tidak dapat dihubungi atau halamannya terlalu besar. Pastikan situs aktif lalu coba lagi.',
        { cause }
    )
}

/**
 * Satu permintaan GET tanpa mengikuti redirect. Dipisah dari RemotePageFetcher supaya test
 * bisa menggantinya dengan situs tiruan lewat container, tanpa jaringan sungguhan.
 */
export default class HttpTransport {
    send(request: TransportRequest): Promise<TransportResponse> {
        const url = new URL(request.url)
        const client = url.protocol === 'https:' ? https : http
        const family = net.isIPv6(request.ip) ? 6 : 4

        // Mengunci koneksi ke IP yang sudah diperiksa, mencegah DNS rebinding di antara pemeriksaan dan koneksi.
        const lookup: net.LookupFunction = (_hostname, options, callback) => {
            if (options.all) {
                callback(null, [{ address: request.ip, family }])

                return
            }

            callback(null, request.ip, family)
        }

        return new Promise((resolve, reject) => {
            const outgoing = client.request(
                url,
                {
                    method: 'GET',
                    headers: request.headers,
                    lookup,
                    // Tanpa agent bersama, soket dari permintaan lain (ke IP lain) tidak pernah dipakai ulang.
                    agent: false,
                    signal: AbortSignal.timeout(request.timeoutMs),
                },
                (response) => {
                    // Halaman yang menyatakan ukurannya melebihi batas tidak diunduh sama sekali.
                    if (Number(response.headers['content-length'] ?? 0) > request.maxBytes) {
                        response.destroy()
                        reject(
                            connectionFailure(
                                new Error(`Content-Length melebihi ${request.maxBytes} byte`)
                            )
                        )

                        return
                    }

                    const chunks: Buffer[] = []
                    let receivedBytes = 0
                    const finish = () =>
                        resolve({
                            status: response.statusCode ?? 0,
                            contentType: response.headers['content-type'] ?? '',
                            location: response.headers.location ?? '',
                            body: Buffer.concat(chunks).subarray(0, request.maxBytes),
                        })

                    response.on('data', (chunk: Buffer) => {
                        chunks.push(chunk)
                        receivedBytes += chunk.length

                        // Halaman yang lebih besar dipotong di batas ini, supaya satu situs tidak menghabiskan memori worker.
                        if (receivedBytes >= request.maxBytes) {
                            finish()
                            response.destroy()
                        }
                    })
                    response.on('end', finish)
                    response.on('error', (error) => reject(connectionFailure(error)))
                }
            )

            outgoing.on('error', (error) => reject(connectionFailure(error)))
            outgoing.end()
        })
    }
}
