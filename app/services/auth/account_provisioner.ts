import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { accountCenter } from '#config/cekcari'
import { assignRole, ROLES } from '#services/permissions'
import type { AuthenticatedIdentity } from '#services/account_center/account_center_result'

/**
 * Menyambungkan identitas Account Center ke akun lokal CekCari lewat email.
 * Akun baru dibuat menunggu aktivasi superadmin, kecuali email superadmin awal dari .env
 * (tanpa itu tidak ada seorang pun yang bisa mengaktifkan akun pertama).
 */
export async function provisionAccount(identity: AuthenticatedIdentity): Promise<User> {
    return db.transaction(async (trx) => {
        const existingUser = await User.query({ client: trx })
            .whereRaw('LOWER(email) = ?', [identity.email])
            .forUpdate()
            .first()
        const user = existingUser ?? new User()

        if (existingUser === null) {
            user.email = identity.email
            user.activatedAt = null
        }

        user.useTransaction(trx)
        user.name = identity.name ?? user.name ?? identity.email
        user.avatarUrl = identity.avatarUrl ?? user.avatarUrl ?? null

        if (isBootstrapSuperadmin(identity.email) && !user.isActive) {
            user.activatedAt = DateTime.now()
        }

        await user.save()

        if (isBootstrapSuperadmin(identity.email)) {
            await assignRole(user, ROLES.superadmin, trx)
        } else if ((await user.related('roles').query().first()) === null) {
            await assignRole(user, ROLES.member, trx)
        }

        return user
    })
}

export function isBootstrapSuperadmin(email: string): boolean {
    const emails = accountCenter.superadminEmails
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry !== '')

    return emails.includes(email.toLowerCase())
}
