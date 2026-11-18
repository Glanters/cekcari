import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Hanya untuk API panel: tanpa sesi login jawabannya 401 (lihat exception handler), bukan redirect.
 */
export default class AuthMiddleware {
    async handle(ctx: HttpContext, next: NextFn, options: { guards?: (keyof Authenticators)[] } = {}) {
        await ctx.auth.authenticateUsing(options.guards)

        return next()
    }
}
