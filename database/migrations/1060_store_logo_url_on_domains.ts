import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Logo tidak lagi disalin ke object storage: yang disimpan adalah alamat ikon di situs pemiliknya.
 * Path lama (berkas di bucket) tidak bisa dipakai sebagai alamat, jadi dikosongkan; crawl berikutnya
 * mengisinya lagi dari situs.
 */
export default class extends BaseSchema {
    protected tableName = 'domains'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('logo_path')
            table.string('logo_url', 2048).nullable()
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('logo_url')
            table.string('logo_path', 255).nullable()
        })
    }
}
