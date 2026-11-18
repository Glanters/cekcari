import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Periode TOTP (time-step) dari kode terakhir yang diterima. Kode yang periodenya tidak lebih baru
 * ditolak, jadi kode yang sama tidak bisa dipakai dua kali selama masih berlaku.
 */
export default class extends BaseSchema {
    protected tableName = 'users'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.bigInteger('two_factor_last_step').nullable()
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('two_factor_last_step')
        })
    }
}
