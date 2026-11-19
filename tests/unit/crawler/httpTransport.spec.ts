import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import { RemoteFetchException } from '#exceptions/RemoteFetchException'
import HttpTransport from '#services/HttpTransport'

function startServer(
    handler: http.RequestListener
): Promise<{ server: http.Server; port: number }> {
    const server = http.createServer(handler)

    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () =>
            resolve({ server, port: (server.address() as AddressInfo).port })
        )
    )
}

function stopServer(server: http.Server): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()))
}

const request = (port: number, maxBytes = 1024) => ({
    // Host ini tidak ada di DNS; permintaan hanya berhasil bila koneksi dikunci ke IP yang diberikan.
    url: `http://tidak-ada.invalid:${port}/halaman`,
    ip: '127.0.0.1',
    headers: { 'User-Agent': 'CekCariBot/1.0' },
    timeoutMs: 2000,
    maxBytes,
})

test.group('HttpTransport', () => {
    test('menghubungi IP yang sudah diperiksa, bukan hasil DNS ulang', async ({
        assert,
        cleanup,
    }) => {
        const { server, port } = await startServer((incoming, outgoing) => {
            outgoing.writeHead(302, { 'Content-Type': 'text/html', 'Location': '/lain' })
            outgoing.end(`host=${incoming.headers.host}`)
        })
        cleanup(() => stopServer(server))

        const response = await new HttpTransport().send(request(port))

        assert.equal(response.status, 302)
        assert.equal(response.location, '/lain')
        assert.equal(response.body.toString(), `host=tidak-ada.invalid:${port}`)
    })

    test('memotong isi halaman di batas ukuran', async ({ assert, cleanup }) => {
        const { server, port } = await startServer((_incoming, outgoing) => {
            outgoing.writeHead(200, { 'Content-Type': 'text/html' })
            outgoing.write('a'.repeat(600))
            outgoing.end('b'.repeat(600))
        })
        cleanup(() => stopServer(server))

        const response = await new HttpTransport().send(request(port, 1000))

        assert.equal(response.body.length, 1000)
    })

    test('menolak halaman yang menyatakan ukurannya melebihi batas', async ({
        assert,
        cleanup,
    }) => {
        const { server, port } = await startServer((_incoming, outgoing) => {
            outgoing.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': '5000' })
            outgoing.end('x'.repeat(5000))
        })
        cleanup(() => stopServer(server))

        await assert.rejects(
            () => new HttpTransport().send(request(port, 1000)),
            RemoteFetchException
        )
    })

    test('kegagalan koneksi menjadi pesan yang aman untuk pengguna', async ({ assert }) => {
        const { server, port } = await startServer((_incoming, outgoing) => outgoing.end())
        await stopServer(server)

        await assert.rejects(
            () => new HttpTransport().send(request(port)),
            'Situs tidak dapat dihubungi atau halamannya terlalu besar. Pastikan situs aktif lalu coba lagi.'
        )
    })
})
