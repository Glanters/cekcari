import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { failure } from '#support/apiResponse'
import { endSession } from '#services/auth/sessionStarter'
import { REJECTION_REASON, allowsUser, rejectionMessage } from '#services/ipWhitelist'

/**
 * Memutus sesi member yang memakai panel dari luar jaringan yang terdaftar di whitelist IP.
 */
export default class EnsureIpIsWhitelistedMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const user = ctx.auth.user
        const ip = ctx.request.ip()

        if (user && !(await allowsUser(user, ip))) {
            await endSession(ctx)

            return failure(ctx, rejectionMessage(ip), { reason: [REJECTION_REASON] }, 403)
        }

        return next()
    }
}
