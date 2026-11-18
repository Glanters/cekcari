import type { ApiClient } from '@japa/api-client'
import { domains } from '#config/cekcari'

/**
 * Rute diikat ke domain lewat header Host, jadi setiap permintaan test menyebut domainnya.
 * Contoh: await panel(client).post('/api/v1/sessions').json({...}).withCsrfToken()
 */
type Method = 'get' | 'post' | 'put' | 'delete'

function onHost(client: ApiClient, host: string) {
    const send = (method: Method) => (path: string) => client[method](path).header('Host', host)

    return { get: send('get'), post: send('post'), put: send('put'), delete: send('delete') }
}

export const search = (client: ApiClient) => onHost(client, domains.search)

export const panel = (client: ApiClient) => onHost(client, domains.panel)
