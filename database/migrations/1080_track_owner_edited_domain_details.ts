import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Deskripsi dan tag bisa diubah pemilik. Waktu perubahan dicatat supaya crawl berkala tidak
 * menimpanya dengan data dari situs; null berarti masih memakai data otomatis.
 */
export default class extends BaseSchema {
    protected tableName = 'domains'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.timestamp('description_edited_at').nullable()
            table.timestamp('tags_edited_at').nullable()
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('description_edited_at')
            table.dropColumn('tags_edited_at')
        })
    }
}
