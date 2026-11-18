import type { ApiClient, ApiRequest } from '@japa/api-client'
import { domains } from '#config/cekcari'

/**
 * Rute diikat ke domain lewat header Host, jadi setiap permintaan test menyebut domainnya.
 * Contoh: await panel(client).post('/api/v1/sessions').json({...}).withCsrfToken()
 *
 * Tipe kembalian ditulis ApiRequest agar body .json() tidak disimpulkan sebagai never untuk rute
 * yang tidak tercatat di tipe rute bawaan Japa.
 */
type HostRequests = {
    get: (path: string) => ApiRequest
    post: (path: string) => ApiRequest
    put: (path: string) => ApiRequest
    delete: (path: string) => ApiRequest
}

function onHost(client: ApiClient, host: string): HostRequests {
    return {
        get: (path) => client.get(path).header('Host', host),
        post: (path) => client.post(path).header('Host', host),
        put: (path) => client.put(path).header('Host', host),
        delete: (path) => client.delete(path).header('Host', host),
    }
}

export const search = (client: ApiClient) => onHost(client, domains.search)

export const panel = (client: ApiClient) => onHost(client, domains.panel)
