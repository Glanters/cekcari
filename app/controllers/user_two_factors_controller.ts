import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { clearFailures } from '#services/auth/two_factor_authenticator'
import { PERMISSIONS, authorize } from '#services/permissions'
import { loadManagedUser } from '#services/managed_user'
import { presentManagedUser } from '#presenters/user_presenter'
import { success } from '#support/api_response'

/**
 * Reset 2FA untuk pengguna yang kehilangan atau mengganti ponsel. Kunci dan recovery code lama
 * langsung tidak berlaku; saat 2FA diwajibkan, login berikutnya meminta pemasangan ulang.
 */
export default class UserTwoFactorsController {
    async destroy(ctx: HttpContext) {
        const admin = ctx.auth.getUserOrFail()
        await authorize(admin, PERMISSIONS.manageUsers)

        const user = await User.findOrFail(ctx.params.id)

        user.twoFactorSecret = null
        user.twoFactorRecoveryCodes = null
        user.twoFactorConfirmedAt = null
        // Periode kode terakhir milik kunci lama; kunci baru mulai dari awal.
        user.twoFactorLastStep = null
        user.updatedBy = admin.id
        await user.save()
        await clearFailures(user)

        return success(
            ctx,
            '2FA berhasil direset',
            presentManagedUser(await loadManagedUser(user.id))
        )
    }
}
