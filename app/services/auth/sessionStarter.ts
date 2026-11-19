import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'
import { forgetPendingLogin } from '#services/auth/pendingLogin'

/**
 * Menyelesaikan login. Guard sesi mengganti ID sesi saat login (mencegah session fixation).
 */
export async function startSession(ctx: HttpContext, user: User): Promise<void> {
    forgetPendingLogin(ctx.session)

    await ctx.auth.use('web').login(user)

    user.lastLoginAt = DateTime.now()
    await user.save()
}

/**
 * Keluar sepenuhnya: data sesi lama (termasuk login tertunda dan rahasia CSRF) dibuang dan ID sesi diganti.
 */
export async function endSession(ctx: HttpContext): Promise<void> {
    await ctx.auth.use('web').logout()
    ctx.session.clear()
    ctx.session.regenerate()
}
