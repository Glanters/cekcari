import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import SessionMiddleware from '@adonisjs/session/session_middleware'
import { domains } from '#config/cekcari'

/**
 * Sesi hanya untuk panel. Pencarian publik tidak punya login, jadi pengunjungnya tidak diberi
 * cookie sesi: lebih hemat privasi, dan halaman pencarian bisa di-cache CDN.
 */
export default class PanelSessionMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        if (ctx.request.hostname() === domains.search) {
            return next()
        }

        const sessionMiddleware = await app.container.make(SessionMiddleware)

        return sessionMiddleware.handle(ctx, next)
    }
}
