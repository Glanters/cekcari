import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pengaturan sistem berbentuk key-value yang bisa diubah superadmin dari dasbor tanpa deploy ulang.
 */
export default class extends BaseSchema {
    protected tableName = 'app_settings'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            table.string('key', 100).notNullable().unique()
            table.jsonb('value').notNullable()
            table
                .bigInteger('created_by')
                .unsigned()
                .nullable()
                .index()
                .references('id')
                .inTable('users')
                .onDelete('SET NULL')
            table
                .bigInteger('updated_by')
                .unsigned()
                .nullable()
                .index()
                .references('id')
                .inTable('users')
                .onDelete('SET NULL')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })

        // Masa uji: 2FA dimatikan dulu atas permintaan pemilik; superadmin menyalakannya dari dasbor
        // sebelum go-live. Bila baris ini hilang, kode menganggap 2FA wajib (aman secara bawaan).
        this.defer(async (db) => {
            const now = new Date()
            await db.table(this.tableName).insert([
                {
                    key: 'auth.two_factor_required',
                    value: JSON.stringify(false),
                    created_at: now,
                    updated_at: now,
                },
                {
                    key: 'security.ip_whitelist_enabled',
                    value: JSON.stringify(false),
                    created_at: now,
                    updated_at: now,
                },
            ])
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
