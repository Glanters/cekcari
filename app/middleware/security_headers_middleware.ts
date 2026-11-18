import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Melengkapi header dari Shield: alamat lengkap tidak bocor ke situs tujuan saat pengunjung
 * membuka hasil pencarian, dan fitur perangkat yang tidak dipakai dimatikan.
 */
export default class SecurityHeadersMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        ctx.response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
        ctx.response.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

        return next()
    }
}
