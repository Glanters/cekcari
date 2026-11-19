import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import { assignRole, ROLES } from '#services/permissions'

const SUPERADMIN_EMAIL = 'sinarjaya69111@gmail.com'
const SUPERADMIN_NAME = 'Sinarjaya'

/**
 * Superadmin pertama. Tidak ada password lokal: akun ini tetap baru bisa masuk setelah Account
 * Center membenarkan email ini, dan sejak login pertama sudah aktif dengan peran superadmin.
 * Aman dijalankan ulang: akun yang sudah ada hanya dipastikan aktif dan berperan superadmin.
 */
export default class SuperadminSeeder extends BaseSeeder {
    async run() {
        await db.transaction(async (trx) => {
            const existingUser = await User.query({ client: trx })
                .whereRaw('LOWER(email) = ?', [SUPERADMIN_EMAIL])
                .forUpdate()
                .first()
            const user = existingUser ?? new User()

            user.useTransaction(trx)

            if (existingUser === null) {
                user.email = SUPERADMIN_EMAIL
                user.name = SUPERADMIN_NAME
            }

            if (!user.isActive) {
                user.activatedAt = DateTime.now()
            }

            await user.save()
            await assignRole(user, ROLES.superadmin, trx)
        })
    }
}
