import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Login lewat Account Center: tidak ada password lokal. Akun lokal menyimpan status aktivasi
 * (diputuskan superadmin) dan data 2FA milik CekCari sendiri.
 */
export default class extends BaseSchema {
    protected tableName = 'users'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            table.string('name', 255).notNullable()
            table.string('email', 255).notNullable().unique()
            table.string('avatar_url', 2048).nullable()
            table.timestamp('activated_at').nullable().index()
            table.timestamp('last_login_at').nullable()
            // Kunci TOTP disimpan terenkripsi; recovery code disimpan sebagai hash.
            table.text('two_factor_secret').nullable()
            table.jsonb('two_factor_recovery_codes').nullable()
            table.timestamp('two_factor_confirmed_at').nullable()
            // Periode TOTP (time-step) dari kode terakhir yang diterima. Kode yang periodenya tidak lebih baru
            // ditolak, jadi kode yang sama tidak bisa dipakai dua kali selama masih berlaku.
            table.bigInteger('two_factor_last_step').nullable()
            table.bigInteger('created_by').unsigned().nullable().index().references('id').inTable('users').onDelete('SET NULL')
            table.bigInteger('updated_by').unsigned().nullable().index().references('id').inTable('users').onDelete('SET NULL')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
