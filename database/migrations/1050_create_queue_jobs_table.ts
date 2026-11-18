import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Antrean pekerjaan di PostgreSQL (standar: pekerjaan yang mengubah data tidak memakai Redis).
 * Worker mengambil baris dengan FOR UPDATE SKIP LOCKED, jadi beberapa worker aman berjalan bersamaan.
 */
export default class extends BaseSchema {
    protected tableName = 'queue_jobs'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            table.string('name', 100).notNullable()
            table.jsonb('payload').notNullable()
            // Mencegah pekerjaan yang sama (mis. crawl domain yang sama) mengantre dua kali.
            table.string('unique_key', 191).nullable()
            table.smallint('attempts').notNullable().defaultTo(0)
            table.timestamp('available_at').notNullable().index()
            table.timestamp('reserved_at').nullable().index()
            table.text('last_error').nullable()
            table.timestamp('failed_at').nullable().index()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
        this.schema.raw('CREATE UNIQUE INDEX queue_jobs_unique_key_pending ON queue_jobs (unique_key) WHERE failed_at IS NULL')
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
