import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export type JobPayload = Record<string, unknown>

export type DispatchOptions = {
    // Pekerjaan dengan kunci yang sama tidak dicatat dua kali selama yang pertama belum selesai atau gagal.
    uniqueKey?: string | null
    // Isi dengan transaksi yang sedang berjalan agar pekerjaan ikut batal bila transaksinya gagal.
    client?: QueryClientContract
}

export type ReservedJob = {
    id: number
    name: string
    payload: JobPayload
    attempts: number
}

/**
 * Antrean berbasis PostgreSQL (tabel queue_jobs). Pekerjaan yang mengubah data wajib lewat sini, bukan Redis,
 * supaya pencatatan pekerjaan berada dalam transaksi yang sama dengan perubahan datanya.
 * Semua waktu antrean memakai now() milik basis data agar beberapa worker di server berbeda tetap sepakat.
 */

/**
 * Mengembalikan false bila pekerjaan dengan uniqueKey yang sama masih menunggu atau sedang berjalan.
 */
export async function dispatch(
    name: string,
    payload: JobPayload,
    options: DispatchOptions = {}
): Promise<boolean> {
    const client = options.client ?? db.connection()
    // Tanpa uniqueKey kolomnya NULL (string kosong diubah lewat NULLIF), sehingga tidak pernah bentrok.
    // ON CONFLICT, bukan menangkap pelanggaran unik: di dalam transaksi PostgreSQL pelanggaran unik membatalkan seluruh transaksi.
    const inserted = await client.rawQuery(
        `INSERT INTO queue_jobs (name, payload, unique_key, attempts, available_at, created_at, updated_at)
        VALUES (?, ?::jsonb, NULLIF(?, ''), 0, now(), now(), now())
        ON CONFLICT (unique_key) WHERE failed_at IS NULL DO NOTHING
        RETURNING id`,
        [name, JSON.stringify(payload), options.uniqueKey ?? '']
    )

    return inserted.rows.length > 0
}

/**
 * Mengambil satu pekerjaan yang siap dijalankan. Reservasi yang tidak diperbarui lebih lama dari staleAfterSeconds
 * dianggap milik worker yang mati, sehingga diambil ulang. SKIP LOCKED membuat beberapa worker aman berjalan bersamaan.
 */
export async function reserveNextJob(staleAfterSeconds: number): Promise<ReservedJob | null> {
    const reserved = await db.rawQuery(
        `UPDATE queue_jobs
        SET reserved_at = now(), attempts = attempts + 1, updated_at = now()
        WHERE id = (
            SELECT id FROM queue_jobs
            WHERE failed_at IS NULL
                AND available_at <= now()
                AND (reserved_at IS NULL OR reserved_at < now() - make_interval(secs => ?))
            ORDER BY available_at, id
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, name, payload, attempts`,
        [staleAfterSeconds]
    )
    const row = reserved.rows[0]

    return row
        ? {
              id: Number(row.id),
              name: row.name,
              payload: row.payload,
              attempts: Number(row.attempts),
          }
        : null
}

// Menandai pekerjaan masih dikerjakan, supaya tidak dianggap milik worker yang mati.
export async function touchJob(id: number): Promise<void> {
    await db.rawQuery(
        'UPDATE queue_jobs SET reserved_at = now(), updated_at = now() WHERE id = ?',
        [id]
    )
}

export async function deleteJob(id: number): Promise<void> {
    await db.rawQuery('DELETE FROM queue_jobs WHERE id = ?', [id])
}

export async function releaseJob(id: number, error: string, delaySeconds: number): Promise<void> {
    await db.rawQuery(
        `UPDATE queue_jobs
        SET reserved_at = NULL, last_error = ?, available_at = now() + make_interval(secs => ?), updated_at = now()
        WHERE id = ?`,
        [error, delaySeconds, id]
    )
}

// Baris yang gagal disimpan (tidak dihapus) sebagai jejak; indeks unik hanya berlaku untuk yang belum gagal.
export async function failJob(id: number, error: string): Promise<void> {
    await db.rawQuery(
        'UPDATE queue_jobs SET reserved_at = NULL, last_error = ?, failed_at = now(), updated_at = now() WHERE id = ?',
        [error, id]
    )
}
