/**
 * Deklarasi minimal untuk bagian driver pg yang dipakai langsung (config/database.ts).
 * Lucid memakai pg lewat knex, jadi paket @types/pg tidak perlu ditambahkan.
 */
declare module 'pg' {
    const pg: {
        types: {
            setTypeParser(oid: number, parser: (value: string) => unknown): void
        }
    }

    export default pg
}
