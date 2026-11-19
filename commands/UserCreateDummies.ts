import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export const DUMMY_EMAIL_DOMAIN = 'dummy.test'

/**
 * Akun uji yang langsung aktif: satu superadmin dan beberapa member (email @dummy.test), supaya
 * setiap peran bisa dicoba tanpa menunggu aktivasi. Login lewat Account Center dummy, jadi semua
 * akun memakai ACCOUNTCENTER_DUMMY_PASSWORD. Hanya berjalan selama login dummy aktif, sehingga
 * tidak pernah membuat akun uji di server yang memakai Account Center asli.
 */
export default class UserCreateDummies extends BaseCommand {
    static commandName = 'user:create-dummies'
    static description =
        'Buat akun dummy aktif: 1 superadmin + member (email @dummy.test), atau hapus dengan --remove'

    static options: CommandOptions = { startApp: true }

    @flags.number({ description: 'Jumlah akun member', default: 5 })
    declare members: number

    @flags.boolean({ description: 'Hapus semua akun @dummy.test beserta situs miliknya' })
    declare remove: boolean

    async run() {
        const { default: app } = await import('@adonisjs/core/services/app')
        const { default: db } = await import('@adonisjs/lucid/services/db')
        const { DateTime } = await import('luxon')
        const { default: User } = await import('#models/user')
        const { accountCenter } = await import('#config/cekcari')
        const { ROLES, assignRole } = await import('#services/permissions')

        const isDummyLoginActive =
            accountCenter.driver === 'dummy' &&
            (!app.inProduction || accountCenter.isDummyAllowedInProduction)

        if (!isDummyLoginActive) {
            this.logger.error(
                'Login dummy tidak aktif (ACCOUNTCENTER_DRIVER=dummy). Akun dummy hanya untuk server uji.'
            )
            this.exitCode = 1
            return
        }

        if (this.remove) {
            const deleted = await db
                .from('users')
                .whereILike('email', `%@${DUMMY_EMAIL_DOMAIN}`)
                .delete()
            this.logger.success(`${deleted} akun dummy dihapus.`)
            return
        }

        const memberCount = Math.max(0, Math.min(this.members, 50))
        const accounts = [
            {
                email: `superadmin@${DUMMY_EMAIL_DOMAIN}`,
                name: 'Superadmin Dummy',
                role: ROLES.superadmin,
            },
            ...Array.from({ length: memberCount }, (_, index) => ({
                email: `member${index + 1}@${DUMMY_EMAIL_DOMAIN}`,
                name: `Member Dummy ${index + 1}`,
                role: ROLES.member,
            })),
        ]
        const table = this.ui.table().head(['Email', 'Peran', 'Keterangan'])

        for (const account of accounts) {
            await db.transaction(async (trx) => {
                const existing = await User.query({ client: trx })
                    .whereRaw('lower(email) = ?', [account.email])
                    .first()
                const user = existing ?? new User()

                user.useTransaction(trx)
                user.merge({
                    email: account.email,
                    name: existing?.name ?? account.name,
                    activatedAt: existing?.activatedAt ?? DateTime.now(),
                })
                await user.save()
                await assignRole(user, account.role, trx)

                table.row([
                    account.email,
                    account.role,
                    existing ? 'sudah ada, diaktifkan' : 'baru',
                ])
            })
        }

        table.render()
        this.logger.info(
            `Password semua akun: nilai ACCOUNTCENTER_DUMMY_PASSWORD di .env (${accountCenter.dummyPassword?.release() ?? ''})`
        )
    }
}
