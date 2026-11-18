import { BaseSchema } from '@adonisjs/lucid/schema'

const PERMISSION = 'statistics.view_all'

/**
 * Superadmin melihat jumlah pengunjung dan klik semua situs; member hanya klik situs miliknya.
 */
export default class extends BaseSchema {
    async up() {
        this.defer(async (db) => {
            const now = new Date()
            const [permission] = await db
                .table('permissions')
                .insert({ name: PERMISSION, created_at: now, updated_at: now })
                .returning('id')
            const superadmin = await db.from('roles').where('name', 'superadmin').first()

            if (superadmin) {
                await db.table('permission_role').insert({
                    permission_id: permission.id,
                    role_id: superadmin.id,
                    created_at: now,
                    updated_at: now,
                })
            }
        })
    }

    async down() {
        this.defer(async (db) => {
            await db.from('permissions').where('name', PERMISSION).delete()
        })
    }
}
