import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    async up() {
        this.schema.createTable('tags', (table) => {
            table.bigIncrements('id')
            table.string('name', 40).notNullable().unique()
            table.string('slug', 60).notNullable().unique()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
        this.schema.raw('CREATE INDEX tags_name_trgm_index ON tags USING GIN (name gin_trgm_ops)')

        this.schema.createTable('domain_tag', (table) => {
            table.bigIncrements('id')
            table.bigInteger('domain_id').unsigned().notNullable().index().references('id').inTable('domains').onDelete('CASCADE')
            table.bigInteger('tag_id').unsigned().notNullable().index().references('id').inTable('tags').onDelete('CASCADE')
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
            table.unique(['domain_id', 'tag_id'])
        })
    }

    async down() {
        this.schema.dropTable('domain_tag')
        this.schema.dropTable('tags')
    }
}
