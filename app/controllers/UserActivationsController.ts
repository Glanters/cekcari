import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { isBootstrapSuperadmin } from '#services/auth/accountProvisioner'
import { PERMISSIONS, authorize } from '#services/permissions'
import { loadManagedUser } from '#services/managedUser'
import { presentManagedUser } from '#presenters/userPresenter'
import { failure, success } from '#support/apiResponse'
import { updateUserActivationValidator } from '#validators/userManagementValidator'

export default class UserActivationsController {
    async update(ctx: HttpContext) {
        const admin = ctx.auth.getUserOrFail()
        await authorize(admin, PERMISSIONS.manageUsers)

        const { is_active: isActive } = await ctx.request.validateUsing(
            updateUserActivationValidator
        )
        const user = await User.findOrFail(ctx.params.id)

        // Mencegah superadmin mengunci dirinya sendiri dari panel.
        if (!isActive && Number(user.id) === Number(admin.id)) {
            const message = 'Anda tidak dapat menonaktifkan akun Anda sendiri.'

            return failure(ctx, message, { is_active: [message] }, 422)
        }

        // Superadmin dari ACCOUNTCENTER_SUPERADMIN_EMAILS dipulihkan otomatis setiap kali masuk,
        // jadi perubahan dari dasbor tidak akan bertahan; harus dicabut lewat .env.
        if (!isActive && isBootstrapSuperadmin(user.email)) {
            const message =
                'Akun ini superadmin utama dari konfigurasi server. Hapus emailnya dari ACCOUNTCENTER_SUPERADMIN_EMAILS untuk mengubahnya.'

            return failure(ctx, message, { is_active: [message] }, 422)
        }

        user.activatedAt = isActive ? (user.activatedAt ?? DateTime.now()) : null
        user.updatedBy = admin.id
        await user.save()

        return success(
            ctx,
            isActive ? 'Akun berhasil diaktifkan' : 'Akun berhasil dinonaktifkan',
            presentManagedUser(await loadManagedUser(user.id))
        )
    }
}
