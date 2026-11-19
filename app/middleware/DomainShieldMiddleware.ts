import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ShieldMiddleware from '@adonisjs/shield/shield_middleware'
import type { ShieldConfig } from '@adonisjs/shield/types'
import { domains } from '#config/cekcari'

let searchDomainShield: ShieldMiddleware | null = null

/**
 * Domain pencarian tetap mendapat header keamanan (CSP, X-Frame-Options, HSTS, nosniff), tetapi
 * tanpa perlindungan CSRF: penjaga CSRF Shield selalu membuat sesi dan cookie XSRF-TOKEN, padahal
 * di sana tidak ada login dan tidak ada form yang mengubah data milik pengunjung.
 */
async function shieldWithoutCsrf(): Promise<ShieldMiddleware> {
    if (searchDomainShield === null) {
        const config = app.config.get<ShieldConfig>('shield')
        const encryption = (await app.container.make('encryption')).use()
        const edge = (await import('edge.js')).default

        searchDomainShield = new ShieldMiddleware(
            { ...config, csrf: { enabled: false } },
            encryption,
            edge
        )
    }

    return searchDomainShield
}

export default class DomainShieldMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const shield =
            ctx.request.hostname() === domains.search
                ? await shieldWithoutCsrf()
                : await app.container.make(ShieldMiddleware)

        return shield.handle(ctx, next)
    }
}
