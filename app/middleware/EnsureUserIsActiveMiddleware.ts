import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { failure } from '#support/apiResponse'
import { endSession } from '#services/auth/sessionStarter'

/**
 * Akun yang dinonaktifkan superadmin langsung kehilangan akses, termasuk sesi yang sedang berjalan.
 */
export default class EnsureUserIsActiveMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const user = ctx.auth.user

        if (user && !user.isActive) {
            await endSession(ctx)

            return failure(
                ctx,
                'Akun Anda sedang tidak aktif. Hubungi superadmin CekCari.',
                { reason: ['account_inactive'] },
                403
            )
        }

        return next()
    }
}
