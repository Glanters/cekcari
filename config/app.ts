import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'
import { BlockList, isIP } from 'node:net'

/**
 * Hanya proxy yang terdaftar di TRUSTED_PROXIES yang boleh mengirim X-Forwarded-For.
 * Tanpa daftar, IP diambil langsung dari koneksi sehingga tidak bisa dipalsukan lewat header.
 */
const trustedProxies = new BlockList()

for (const entry of (env.get('TRUSTED_PROXIES') ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
    const [address, prefix] = entry.split('/')
    const family = isIP(address) === 6 ? 'ipv6' : 'ipv4'

    if (isIP(address) === 0) {
        continue
    }

    if (prefix === undefined) {
        trustedProxies.addAddress(address, family)
    } else {
        trustedProxies.addSubnet(address, Number(prefix), family)
    }
}

export const http = defineConfig({
    generateRequestId: true,
    trustProxy: (address: string) => {
        const family = isIP(address) === 6 ? 'ipv6' : 'ipv4'

        return isIP(address) !== 0 && trustedProxies.check(address, family)
    },
    allowMethodSpoofing: false,
    useAsyncLocalStorage: false,
    // Rute spesifik (mis. /api/v1/...) selalu menang atas catch-all SPA, apa pun urutan berkas rute dimuat.
    router: { matcher: 'tree', precedence: 'specificity' },
    redirect: { forwardQueryString: false },
    cookie: {
        domain: '',
        path: '/',
        maxAge: '2h',
        httpOnly: true,
        secure: app.inProduction,
        sameSite: 'lax',
    },
})
