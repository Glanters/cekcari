import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Statistik pengunjung dan klik. Pengunjung dikenali dari ID acak di browsernya; yang disimpan
 * hanya hash ID itu, tanpa IP, nama, atau data pribadi lain.
 */
export default class extends BaseSchema {
    async up() {
        // Satu baris per pengunjung per hari: kolom views menghitung berapa kali halaman dibuka.
        this.schema.createTable('site_visits', (table) => {
            table.bigIncrements('id')
            table.string('visitor_key', 64).notNullable()
            table.date('visited_on').notNullable().index()
            table.integer('views').notNullable().defaultTo(1)
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.unique(['visitor_key', 'visited_on'])
        })

        this.schema.createTable('domain_clicks', (table) => {
            table.bigIncrements('id')
            table
                .bigInteger('domain_id')
                .unsigned()
                .notNullable()
                .index()
                .references('id')
                .inTable('domains')
                .onDelete('CASCADE')
            table.string('visitor_key', 64).notNullable()
            table.boolean('is_promoted').notNullable().defaultTo(false)
            table.timestamp('clicked_at').notNullable().index()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.index(['domain_id', 'clicked_at'])
        })
    }

    async down() {
        this.schema.dropTable('domain_clicks')
        this.schema.dropTable('site_visits')
    }
}
