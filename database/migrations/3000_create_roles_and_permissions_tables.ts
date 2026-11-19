import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Peran dan izin (padanan Spatie Laravel Permission di versi Laravel). Endpoint memeriksa izin,
 * bukan nama peran, supaya peran baru cukup diberi izin tanpa mengubah kode endpoint.
 * Nama di sini sengaja ditulis langsung (bukan diimpor dari kode aplikasi) agar isi migration
 * tidak ikut berubah bila kode aplikasi berubah.
 */
export default class extends BaseSchema {
    async up() {
        this.schema.createTable('roles', (table) => {
            table.bigIncrements('id')
            table.string('name', 50).notNullable().unique()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })

        this.schema.createTable('permissions', (table) => {
            table.bigIncrements('id')
            table.string('name', 100).notNullable().unique()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })

        this.schema.createTable('permission_role', (table) => {
            table.bigIncrements('id')
            table
                .bigInteger('permission_id')
                .unsigned()
                .notNullable()
                .index()
                .references('id')
                .inTable('permissions')
                .onDelete('CASCADE')
            table
                .bigInteger('role_id')
                .unsigned()
                .notNullable()
                .index()
                .references('id')
                .inTable('roles')
                .onDelete('CASCADE')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.unique(['permission_id', 'role_id'])
        })

        this.schema.createTable('role_user', (table) => {
            table.bigIncrements('id')
            table
                .bigInteger('role_id')
                .unsigned()
                .notNullable()
                .index()
                .references('id')
                .inTable('roles')
                .onDelete('CASCADE')
            table
                .bigInteger('user_id')
                .unsigned()
                .notNullable()
                .index()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.unique(['role_id', 'user_id'])
        })

        this.defer(async (db) => {
            const now = new Date()
            const [superadmin] = await db
                .table('roles')
                .insert([
                    { name: 'superadmin', created_at: now, updated_at: now },
                    { name: 'member', created_at: now, updated_at: now },
                ])
                .returning('id')
            const permissions = await db
                .table('permissions')
                .insert([
                    { name: 'manage-users', created_at: now, updated_at: now },
                    { name: 'manage-security', created_at: now, updated_at: now },
                    // Superadmin boleh melihat dan mengelola (tambah, ubah, hapus) situs milik semua member.
                    { name: 'domains.view_all', created_at: now, updated_at: now },
                    { name: 'domains.manage_all', created_at: now, updated_at: now },
                    // Superadmin melihat jumlah pengunjung dan klik semua situs; member hanya klik situs miliknya.
                    { name: 'statistics.view_all', created_at: now, updated_at: now },
                ])
                .returning('id')

            await db.table('permission_role').insert(
                permissions.map((permission) => ({
                    permission_id: permission.id,
                    role_id: superadmin.id,
                    created_at: now,
                    updated_at: now,
                }))
            )
        })
    }

    async down() {
        this.schema.dropTable('role_user')
        this.schema.dropTable('permission_role')
        this.schema.dropTable('permissions')
        this.schema.dropTable('roles')
    }
}
