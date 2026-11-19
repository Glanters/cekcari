import { test } from '@japa/runner'
import { RemoteFetchException } from '#exceptions/RemoteFetchException'
import UrlGuard from '#services/UrlGuard'

const publicDns = async () => ['93.184.216.34']

test.group('UrlGuard', () => {
    test('mengizinkan host yang mengarah ke ip publik', async ({ assert }) => {
        const guard = new UrlGuard(publicDns)

        assert.deepEqual(await guard.inspect('https://tokoku.com/x'), {
            host: 'tokoku.com',
            port: 443,
            ip: '93.184.216.34',
        })
    })

    test('menolak url yang tidak aman: {name}')
        .with([
            { name: 'skema file', url: 'file:///etc/passwd' },
            { name: 'port tidak standar', url: 'https://tokoku.com:8080/' },
            { name: 'kredensial di url', url: 'https://user:pass@tokoku.com/' },
            { name: 'ip loopback langsung', url: 'http://127.0.0.1/' },
            { name: 'metadata cloud', url: 'http://169.254.169.254/latest/meta-data' },
            { name: 'loopback ipv6', url: 'http://[::1]/' },
            { name: 'ipv4 dibungkus ipv6', url: 'http://[::ffff:127.0.0.1]/' },
            { name: 'unique local ipv6', url: 'http://[fd00::1]/' },
            { name: 'ip desimal', url: 'http://2130706433/' },
        ])
        .run(async ({ assert }, { url }) => {
            await assert.rejects(() => new UrlGuard(publicDns).inspect(url), RemoteFetchException)
        })

    test('menolak host yang mengarah ke jaringan internal: {address}')
        .with(['10.1.2.3', '192.168.1.10', '100.64.0.1', 'fe80::1', '::1'])
        .run(async ({ assert }, address) => {
            await assert.rejects(
                () => new UrlGuard(async () => [address]).inspect('https://jebakan.com'),
                'Alamat mengarah ke jaringan internal dan tidak dapat diproses.'
            )
        })

    test('menolak bila salah satu alamat hasil DNS internal', async ({ assert }) => {
        await assert.rejects(
            () =>
                new UrlGuard(async () => ['93.184.216.34', '10.0.0.5']).inspect(
                    'https://campur.com'
                ),
            'Alamat mengarah ke jaringan internal dan tidak dapat diproses.'
        )
    })

    test('mengizinkan ipv6 publik', async ({ assert }) => {
        const target = await new UrlGuard(async () => [
            '2606:2800:220:1:248:1893:25c8:1946',
        ]).inspect('https://v6.tokoku.com/')

        assert.equal(target.ip, '2606:2800:220:1:248:1893:25c8:1946')
    })

    test('menolak host yang tidak dapat di-resolve', async ({ assert }) => {
        await assert.rejects(
            () => new UrlGuard(async () => []).inspect('https://tidak-ada.test'),
            'Domain tidak dapat ditemukan. Periksa kembali penulisan alamatnya.'
        )
    })
})
