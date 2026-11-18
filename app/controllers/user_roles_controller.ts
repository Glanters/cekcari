import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { isBootstrapSuperadmin } from '#services/auth/account_provisioner'
import { PERMISSIONS, assignRole, authorize } from '#services/permissions'
import { loadManagedUser } from '#services/managed_user'
import { presentManagedUser } from '#presenters/user_presenter'
import { failure, success } from '#support/api_response'
import { updateUserRoleValidator } from '#validators/user_management_validator'

export default class UserRolesController {
    async update(ctx: HttpContext) {
        const admin = ctx.auth.getUserOrFail()
        await authorize(admin, PERMISSIONS.manageUsers)

        const { role } = await ctx.request.validateUsing(updateUserRoleValidator)
        const user = await User.findOrFail(ctx.params.id)

        // Superadmin tidak bisa menurunkan perannya sendiri, supaya selalu ada yang bisa mengelola akun.
        if (Number(user.id) === Number(admin.id)) {
            const message = 'Anda tidak dapat mengubah peran akun Anda sendiri.'

            return failure(ctx, message, { role: [message] }, 422)
        }

        // Superadmin dari ACCOUNTCENTER_SUPERADMIN_EMAILS dipulihkan otomatis setiap kali masuk,
        // jadi perubahan dari dasbor tidak akan bertahan; harus dicabut lewat .env.
        if (isBootstrapSuperadmin(user.email)) {
            const message =
                'Akun ini superadmin utama dari konfigurasi server. Hapus emailnya dari ACCOUNTCENTER_SUPERADMIN_EMAILS untuk mengubahnya.'

            return failure(ctx, message, { role: [message] }, 422)
        }

        await db.transaction(async (trx) => {
            await assignRole(user, role, trx)
            user.updatedBy = admin.id
            await user.save()
        })

        return success(
            ctx,
            'Peran akun berhasil diubah',
            presentManagedUser(await loadManagedUser(user.id))
        )
    }
}
