import env from '#start/env'
import pg from 'pg'
import { defineConfig } from '@adonisjs/lucid'

// Kolom id memakai bigint; driver pg mengembalikannya sebagai teks. Nilai id CekCari jauh di bawah
// batas angka aman JavaScript (2^53), jadi dibaca sebagai angka agar JSON dan perbandingan konsisten.
const BIGINT_OID = 20
pg.types.setTypeParser(BIGINT_OID, (value) => Number.parseInt(value, 10))

const dbConfig = defineConfig({
    connection: 'pg',
    connections: {
        pg: {
            client: 'pg',
            connection: {
                host: env.get('DB_HOST'),
                port: env.get('DB_PORT'),
                user: env.get('DB_USER'),
                password: env.get('DB_PASSWORD')?.release(),
                database: env.get('DB_DATABASE'),
            },
            migrations: {
                naturalSort: true,
                paths: ['database/migrations'],
            },
            schemaGeneration: { enabled: false },
            // Log query dimatikan: binding bisa berisi email dan data pribadi.
            debug: false,
        },
    },
})

export default dbConfig
