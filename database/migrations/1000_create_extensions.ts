import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    async up() {
        // pg_trgm untuk toleransi salah ketik dan saran pencarian.
        this.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    }

    async down() {
        this.schema.raw('DROP EXTENSION IF EXISTS pg_trgm')
    }
}
