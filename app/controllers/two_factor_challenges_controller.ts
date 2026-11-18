import type { HttpContext } from '@adonisjs/core/http'
import { LOGIN_STATUS } from '#controllers/sessions_controller'
import {
    forgetPendingLogin,
    pendingLoginUser,
    recordFailedAttempt,
} from '#services/auth/pending_login'
import { startSession } from '#services/auth/session_starter'
import * as twoFactor from '#services/auth/two_factor_authenticator'
import { REJECTION_REASON, allowsUser, rejectionMessage } from '#services/ip_whitelist'
import { presentUser } from '#presenters/user_presenter'
import { failure, success } from '#support/api_response'
import { storeTwoFactorChallengeValidator } from '#validators/auth_validator'

/**
 * Langkah kedua login untuk akun yang sudah memasang 2FA.
 */
export default class TwoFactorChallengesController {
    async store(ctx: HttpContext) {
        const { code } = await ctx.request.validateUsing(storeTwoFactorChallengeValidator)
        const user = await pendingLoginUser(ctx.session)

        if (user === null || !user.isActive || !user.hasConfirmedTwoFactor) {
            forgetPendingLogin(ctx.session)

            return failure(ctx, 'Sesi masuk sudah berakhir. Silakan masuk ulang.', {}, 410)
        }

        const ip = ctx.request.ip()

        if (!(await allowsUser(user, ip))) {
            forgetPendingLogin(ctx.session)

            return failure(ctx, rejectionMessage(ip), { reason: [REJECTION_REASON] }, 403)
        }

        if (await twoFactor.isLockedOut(user)) {
            forgetPendingLogin(ctx.session)

            return failure(ctx, await twoFactor.lockoutMessage(user), {}, 429)
        }

        const isValid = twoFactor.isTotpCode(code)
            ? await twoFactor.verifyCode(user, user.twoFactorSecret!, code)
            : await twoFactor.consumeRecoveryCode(user, code)

        if (!isValid) {
            await twoFactor.recordFailure(user)

            if (!recordFailedAttempt(ctx.session)) {
                return failure(ctx, 'Terlalu banyak kode salah. Silakan masuk ulang.', {}, 410)
            }

            const message = 'Kode salah atau sudah kedaluwarsa.'

            return failure(ctx, message, { code: [message] }, 422)
        }

        await twoFactor.clearFailures(user)
        await startSession(ctx, user)
        await user.load('roles')

        return success(ctx, 'Berhasil masuk', {
            status: LOGIN_STATUS.authenticated,
            user: presentUser(user),
        })
    }
}
