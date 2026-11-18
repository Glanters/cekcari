import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { LOGIN_STATUS } from '#controllers/sessions_controller'
import {
    forgetPendingLogin,
    pendingLoginUser,
    pendingSetupSecret,
    recordFailedAttempt,
} from '#services/auth/pending_login'
import { startSession } from '#services/auth/session_starter'
import * as twoFactor from '#services/auth/two_factor_authenticator'
import { REJECTION_REASON, allowsUser, rejectionMessage } from '#services/ip_whitelist'
import { presentUser } from '#presenters/user_presenter'
import { failure, success } from '#support/api_response'
import { storeTwoFactorSetupValidator } from '#validators/auth_validator'

/**
 * Pemasangan 2FA pertama kali, di tengah proses login. Kunci baru disimpan hanya setelah
 * pengguna membuktikan authenticator-nya sudah menghasilkan kode yang benar.
 */
export default class TwoFactorSetupsController {
    async store(ctx: HttpContext) {
        const { code } = await ctx.request.validateUsing(storeTwoFactorSetupValidator)
        const user = await pendingLoginUser(ctx.session)
        const secret = pendingSetupSecret(ctx.session)

        // Akun yang sudah memasang 2FA (mis. di tab lain) tidak boleh ditimpa lewat sesi pemasangan lama.
        if (user === null || secret === null || !user.isActive || user.hasConfirmedTwoFactor) {
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

        if (!(await twoFactor.verifyCode(user, secret, code))) {
            await twoFactor.recordFailure(user)

            if (!recordFailedAttempt(ctx.session)) {
                return failure(ctx, 'Terlalu banyak kode salah. Silakan masuk ulang.', {}, 410)
            }

            const message = 'Kode salah. Pastikan jam ponsel Anda tepat, lalu coba kode terbaru.'

            return failure(ctx, message, { code: [message] }, 422)
        }

        const recoveryCodes = twoFactor.generateRecoveryCodes()

        // Hanya menyimpan bila 2FA belum terpasang saat ini juga, supaya dua tab pemasangan yang
        // selesai bersamaan tidak saling menimpa kunci.
        const hashedRecoveryCodes = await twoFactor.hashRecoveryCodes(recoveryCodes)
        const confirmedUser = await db.transaction(async (trx) => {
            const lockedUser = await User.query({ client: trx })
                .where('id', user.id)
                .forUpdate()
                .firstOrFail()

            if (lockedUser.twoFactorConfirmedAt !== null) {
                return null
            }

            lockedUser.twoFactorSecret = secret
            lockedUser.twoFactorRecoveryCodes = hashedRecoveryCodes
            lockedUser.twoFactorConfirmedAt = DateTime.now()
            await lockedUser.save()

            return lockedUser
        })

        if (confirmedUser === null) {
            forgetPendingLogin(ctx.session)

            return failure(ctx, 'Sesi masuk sudah berakhir. Silakan masuk ulang.', {}, 410)
        }

        await twoFactor.clearFailures(confirmedUser)
        await startSession(ctx, confirmedUser)
        await confirmedUser.load('roles')

        return success(ctx, '2FA aktif. Simpan recovery code Anda di tempat aman.', {
            status: LOGIN_STATUS.authenticated,
            user: presentUser(confirmedUser),
            recovery_codes: recoveryCodes,
        })
    }
}
