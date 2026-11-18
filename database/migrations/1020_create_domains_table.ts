import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'domains'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            table.bigInteger('user_id').unsigned().notNullable().index().references('id').inTable('users').onDelete('CASCADE')
            // Link lengkap yang didaftarkan pemilik (boleh memuat path).
            table.string('url', 255).notNullable()
            table.string('host', 255).notNullable().index()
            table.string('title', 120).notNullable()
            table.text('description').notNullable()
            table.string('logo_path', 255).nullable()
            table.boolean('is_promoted').notNullable().defaultTo(false).index()
            table.string('crawl_status', 20).notNullable().defaultTo('pending')
            table.string('redirected_to', 2048).nullable()
            table.timestamp('last_crawled_at').nullable()
            table.bigInteger('created_by').unsigned().nullable().index().references('id').inTable('users').onDelete('SET NULL')
            table.bigInteger('updated_by').unsigned().nullable().index().references('id').inTable('users').onDelete('SET NULL')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.timestamp('deleted_at').nullable()
        })

        // Titik pada host diganti spasi agar "tokoku.com" juga cocok dengan pencarian "tokoku".
        this.schema.raw(`
            ALTER TABLE domains ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('simple', replace(coalesce(host, ''), '.', ' ')), 'B') ||
                setweight(to_tsvector('simple', coalesce(description, '')), 'C')
            ) STORED
        `)
        this.schema.raw('CREATE INDEX domains_search_vector_index ON domains USING GIN (search_vector)')
        this.schema.raw('CREATE INDEX domains_title_trgm_index ON domains USING GIN (title gin_trgm_ops)')
        this.schema.raw('CREATE INDEX domains_host_trgm_index ON domains USING GIN (host gin_trgm_ops)')
        // Satu link hanya boleh terdaftar sekali (http/https dianggap sama); path berbeda boleh.
        this.schema.raw("CREATE UNIQUE INDEX domains_address_unique ON domains ((split_part(url, '://', 2))) WHERE deleted_at IS NULL")
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
