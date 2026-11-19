import { BlockList, SocketAddress, isIP } from 'node:net'
import AppSetting from '#models/AppSetting'
import IpWhitelistEntry from '#models/IpWhitelistEntry'
import type User from '#models/user'
import { isSuperadmin } from '#services/permissions'

/**
 * Whitelist IP global untuk panel pemilik (sama seperti lacak-hp). Bila aktif, member hanya bisa
 * masuk dan memakai panel dari alamat yang terdaftar. Diperiksa saat login, di kedua langkah 2FA,
 * DAN di setiap permintaan, jadi sesi yang sedang berjalan ikut terputus begitu pindah jaringan.
 *
 * Superadmin dikecualikan supaya pengelola tidak bisa mengunci dirinya sendiri dan selalu
 * bisa memperbaiki daftar. Domain pencarian publik tidak terpengaruh (middleware hanya di rute panel).
 *
 * Status dan daftar dibaca langsung dari database (tanpa cache proses) supaya perubahan langsung
 * berlaku di semua proses server.
 */
export const IP_WHITELIST_SETTING_KEY = 'security.ip_whitelist_enabled'

export const MAX_ENTRIES = 200

export const REJECTION_REASON = 'ip_not_allowed'

type Snapshot = { isEnabled: boolean; entries: string[] }

async function snapshot(): Promise<Snapshot> {
    const isEnabled = Boolean(await AppSetting.valueOf(IP_WHITELIST_SETTING_KEY, false))
    const entries = await IpWhitelistEntry.query().select('value')

    return { isEnabled, entries: entries.map((entry) => entry.value) }
}

// Server dengan soket IPv6 bisa melaporkan "::ffff:10.0.0.5"; dicocokkan sebagai 10.0.0.5.
function unmapIpv4(ip: string): string {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)

    return mapped ? mapped[1] : ip
}

function familyOf(address: string): 'ipv4' | 'ipv6' {
    return isIP(address) === 6 ? 'ipv6' : 'ipv4'
}

/**
 * Apakah alamat ini tercakup salah satu entri (entri sudah dalam bentuk baku).
 */
export function matchesAny(ip: string, entries: string[]): boolean {
    const address = unmapIpv4(ip.trim())

    if (isIP(address) === 0 || entries.length === 0) {
        return false
    }

    const blockList = new BlockList()

    for (const entry of entries) {
        const [entryAddress, prefix] = entry.split('/')

        if (prefix === undefined) {
            blockList.addAddress(entryAddress, familyOf(entryAddress))
        } else {
            blockList.addSubnet(entryAddress, Number(prefix), familyOf(entryAddress))
        }
    }

    return blockList.check(address, familyOf(address))
}

export async function isIpWhitelistEnabled(): Promise<boolean> {
    const { isEnabled } = await snapshot()

    return isEnabled
}

/**
 * Whitelist yang aktif tetapi kosong dianggap mati, supaya tidak ada yang terkunci karena salah urutan.
 */
export async function allowsIp(ip: string): Promise<boolean> {
    const { isEnabled, entries } = await snapshot()

    if (!isEnabled || entries.length === 0) {
        return true
    }

    return matchesAny(ip, entries)
}

// Apakah alamat ini tercakup daftar, terlepas dari whitelist sedang aktif atau tidak.
export async function whitelistContains(ip: string): Promise<boolean> {
    const { entries } = await snapshot()

    return matchesAny(ip, entries)
}

export async function allowsUser(user: User, ip: string): Promise<boolean> {
    return (await allowsIp(ip)) || (await isSuperadmin(user))
}

export function rejectionMessage(ip: string): string {
    return `Akses panel hanya diizinkan dari jaringan yang terdaftar. IP Anda (${ip}) tidak ada di whitelist. Hubungi superadmin CekCari.`
}

export async function setIpWhitelistEnabled(isEnabled: boolean, changedBy: User): Promise<void> {
    await AppSetting.store(IP_WHITELIST_SETTING_KEY, isEnabled, changedBy.id)
}

/**
 * Bentuk baku sebuah entri ("10.0.0.5", "10.0.0.0/24", "2001:db8::/32"), atau null bila tidak sah.
 * Prefix /0 ditolak karena sama saja mengizinkan semua alamat.
 */
export function normalizeEntry(value: string): string | null {
    const parts = value.trim().split('/')
    const family = isIP(parts[0])

    if (parts.length > 2 || family === 0) {
        return null
    }

    // SocketAddress memakai inet_ntop, jadi hasilnya sama dengan versi PHP ("2001:DB8:0::1" → "2001:db8::1").
    const address = new SocketAddress({ address: parts[0], family: family === 6 ? 'ipv6' : 'ipv4' })
        .address

    if (parts.length === 1) {
        return address
    }

    const maxPrefix = family === 6 ? 128 : 32
    const isValidPrefix =
        /^\d{1,3}$/.test(parts[1]) && Number(parts[1]) >= 1 && Number(parts[1]) <= maxPrefix

    return isValidPrefix ? `${address}/${Number(parts[1])}` : null
}
