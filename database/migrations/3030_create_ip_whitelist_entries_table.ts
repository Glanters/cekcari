import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'ip_whitelist_entries'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            // Alamat IP tunggal atau rentang CIDR (IPv4/IPv6), disimpan dalam bentuk baku.
            table.string('value', 64).notNullable().unique()
            table.string('label', 100).nullable()
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
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
