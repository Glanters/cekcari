import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'pages'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id')
            table.bigInteger('domain_id').unsigned().notNullable().index().references('id').inTable('domains').onDelete('CASCADE')
            table.string('url', 2048).notNullable()
            table.string('title', 255).nullable()
            table.text('description').nullable()
            // Teks bersih halaman, dipotong sesuai crawler.maxContentChars.
            table.text('content').nullable()
            table.smallint('http_status').notNullable()
            table.timestamp('crawled_at').notNullable()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.unique(['domain_id', 'url'])
        })

        this.schema.raw(`
            ALTER TABLE pages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(content, '')), 'D')
            ) STORED
        `)
        this.schema.raw('CREATE INDEX pages_search_vector_index ON pages USING GIN (search_vector)')
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
