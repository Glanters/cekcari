import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Kolom ini dulu ditambahkan migrasi 1080 yang kemudian digabung ke 1020_create_domains_table.
 * Database yang sudah menjalankan 1020 versi lama tetapi belum pernah menjalankan 1080 tidak akan
 * mendapat kolom ini lagi, jadi ditambahkan di sini bila belum ada. Database baru sudah memilikinya
 * dari 1020, sehingga migrasi ini tidak mengubah apa pun di sana.
 */
export default class extends BaseSchema {
    async up() {
        this.schema.raw(
            'ALTER TABLE domains ADD COLUMN IF NOT EXISTS description_edited_at timestamp NULL,' +
                ' ADD COLUMN IF NOT EXISTS tags_edited_at timestamp NULL'
        )
    }

    // Kolom tetap milik 1020_create_domains_table; membatalkan migrasi ini tidak boleh menghapusnya.
    async down() {}
}
