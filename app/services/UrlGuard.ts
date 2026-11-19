import dns from 'node:dns'
import net from 'node:net'
import { RemoteFetchException } from '#exceptions/RemoteFetchException'

export type HostResolver = (host: string) => Promise<string[]>

export type InspectedTarget = { host: string; port: number; ip: string }

const ALLOWED_PORTS = [80, 443]

// Rentang IPv4 yang tidak boleh dituju: privat, loopback, link-local (metadata cloud), CGNAT, dokumentasi, dan cadangan.
const NON_PUBLIC_IPV4 = new net.BlockList()
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
] as const) {
    NON_PUBLIC_IPV4.addSubnet(network, prefix, 'ipv4')
}

// IPv6 hanya diizinkan bila berada di rentang unicast global (2000::/3). Dengan begitu loopback, link-local,
// unique-local, multicast, dan alamat IPv4-mapped (::ffff:a.b.c.d) otomatis tertolak.
const GLOBAL_UNICAST_IPV6 = new net.BlockList()
GLOBAL_UNICAST_IPV6.addSubnet('2000::', 3, 'ipv6')

// Bagian dari 2000::/3 yang tetap bukan tujuan publik; 6to4 dan Teredo bisa membungkus alamat IPv4 internal.
const NON_PUBLIC_IPV6 = new net.BlockList()
for (const [network, prefix] of [
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
] as const) {
    NON_PUBLIC_IPV6.addSubnet(network, prefix, 'ipv6')
}

/**
 * Semua alamat hasil DNS (IPv4 dan IPv6) ikut diperiksa, bukan hanya yang pertama.
 * Kegagalan DNS diperlakukan sebagai "tidak ditemukan" karena itulah yang perlu diketahui pemilik link.
 */
export async function resolveWithSystemDns(host: string): Promise<string[]> {
    try {
        const records = await dns.promises.lookup(host, { all: true })

        return records.map((record) => record.address)
    } catch (error) {
        if (isDnsError(error)) {
            return []
        }

        throw error
    }
}

function isDnsError(error: unknown): boolean {
    return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

export function isPublicAddress(address: string): boolean {
    if (net.isIPv4(address)) {
        return !NON_PUBLIC_IPV4.check(address, 'ipv4')
    }

    if (net.isIPv6(address)) {
        return GLOBAL_UNICAST_IPV6.check(address, 'ipv6') && !NON_PUBLIC_IPV6.check(address, 'ipv6')
    }

    return false
}

/**
 * Mencegah server dipakai untuk mengakses jaringan internal (SSRF): setiap URL yang akan
 * diambil harus http/https, port standar, dan host-nya mengarah ke IP publik.
 */
export default class UrlGuard {
    constructor(private readonly resolver: HostResolver = resolveWithSystemDns) {}

    async inspect(url: string): Promise<InspectedTarget> {
        const parsed = URL.parse(url)
        const scheme = parsed?.protocol.replace(/:$/, '') ?? ''

        if (parsed === null || !['http', 'https'].includes(scheme) || parsed.hostname === '') {
            throw new RemoteFetchException('Alamat harus diawali http:// atau https://.')
        }

        if (parsed.username !== '' || parsed.password !== '') {
            throw new RemoteFetchException(
                'Alamat tidak boleh memuat nama pengguna atau kata sandi.'
            )
        }

        const port = parsed.port !== '' ? Number(parsed.port) : scheme === 'https' ? 443 : 80

        if (!ALLOWED_PORTS.includes(port)) {
            throw new RemoteFetchException('Hanya port 80 dan 443 yang diizinkan.')
        }

        // Literal IPv6 ditulis dalam kurung siku di URL ("http://[::1]/").
        const host = parsed.hostname.replace(/^\[(.*)\]$/, '$1')
        const addresses = net.isIP(host) !== 0 ? [host] : await this.resolver(host)

        if (addresses.length === 0) {
            throw new RemoteFetchException(
                'Domain tidak dapat ditemukan. Periksa kembali penulisan alamatnya.'
            )
        }

        if (!addresses.every((address) => isPublicAddress(address))) {
            throw new RemoteFetchException(
                'Alamat mengarah ke jaringan internal dan tidak dapat diproses.'
            )
        }

        return { host, port, ip: addresses[0] }
    }
}
