import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import AccountCenter from '#services/account_center/account_center'
import { provisionAccount } from '#services/auth/account_provisioner'
import { forgetPendingLogin, startPendingLogin } from '#services/auth/pending_login'
import { endSession, startSession } from '#services/auth/session_starter'
import * as twoFactor from '#services/auth/two_factor_authenticator'
import { REJECTION_REASON, allowsUser, rejectionMessage } from '#services/ip_whitelist'
import { isTwoFactorRequired } from '#services/two_factor_policy'
import { presentUser } from '#presenters/user_presenter'
import { failure, success } from '#support/api_response'
import { storeSessionValidator } from '#validators/auth_validator'

export const LOGIN_STATUS = {
    authenticated: 'authenticated',
    twoFactorChallenge: 'two_factor_challenge',
    twoFactorSetup: 'two_factor_setup',
} as const

/**
 * Langkah pertama login: email + kata sandi diperiksa Account Center. Setelah itu, tergantung
 * pengaturan 2FA, pengguna langsung masuk, diminta kode 2FA, atau diminta memasang 2FA dulu.
 */
@inject()
export default class SessionsController {
    constructor(private readonly accountCenter: AccountCenter) {}

    async store(ctx: HttpContext) {
        forgetPendingLogin(ctx.session)

        const { email, password } = await ctx.request.validateUsing(storeSessionValidator)
        const result = await this.accountCenter.authenticate(email.toLowerCase(), password)

        if (result.outcome === 'unavailable') {
            return failure(
                ctx,
                'Account Center sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.',
                {},
                503
            )
        }

        if (result.outcome === 'rejected') {
            const message = 'Email atau kata sandi Account Center salah.'

            return failure(ctx, message, { email: [message] }, 422)
        }

        const user = await provisionAccount(result.identity)

        if (!user.isActive) {
            return failure(
                ctx,
                'Akun Anda belum diaktifkan. Minta superadmin CekCari mengaktifkan akun ini, lalu masuk lagi.',
                {},
                403
            )
        }

        const ip = ctx.request.ip()

        if (!(await allowsUser(user, ip))) {
            return failure(ctx, rejectionMessage(ip), { reason: [REJECTION_REASON] }, 403)
        }

        if (!(await isTwoFactorRequired())) {
            await startSession(ctx, user)
            await user.load('roles')

            return success(ctx, 'Berhasil masuk', {
                status: LOGIN_STATUS.authenticated,
                user: presentUser(user),
            })
        }

        if (await twoFactor.isLockedOut(user)) {
            return failure(ctx, await twoFactor.lockoutMessage(user), {}, 429)
        }

        if (user.hasConfirmedTwoFactor) {
            startPendingLogin(ctx.session, user)

            return success(ctx, 'Masukkan kode dari aplikasi authenticator Anda.', {
                status: LOGIN_STATUS.twoFactorChallenge,
            })
        }

        const secret = twoFactor.generateSecret()
        startPendingLogin(ctx.session, user, secret)

        return success(ctx, 'Pasang 2FA terlebih dahulu untuk melanjutkan.', {
            status: LOGIN_STATUS.twoFactorSetup,
            two_factor_setup: {
                qr_code: await twoFactor.qrCodeDataUri(user.email, secret),
                secret,
            },
        })
    }

    async destroy(ctx: HttpContext) {
        await endSession(ctx)

        return success(ctx, 'Berhasil keluar')
    }
}
