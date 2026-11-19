import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { statistics } from '#config/cekcari'

// Klik berulang dari pengunjung yang sama ke situs yang sama dalam selang ini dihitung sekali
// (mis. klik ganda tidak sengaja, atau tombol kembali lalu klik lagi).
const DUPLICATE_CLICK_SECONDS = 10

/**
 * ID pengunjung dibuat acak di browser; yang disimpan hanya hash-nya agar tidak bisa dipakai
 * melacak orang yang sama di luar CekCari.
 */
export function visitorKeyOf(visitorId: string): string {
    return createHash('sha256').update(`cekcari:${visitorId}`).digest('hex')
}

export default class VisitTracker {
    async recordVisit(visitorId: string): Promise<void> {
        const now = DateTime.now()

        await db.rawQuery(
            `INSERT INTO site_visits (visitor_key, visited_on, views, created_at, updated_at)
             VALUES (?, ?, 1, ?, ?)
             ON CONFLICT (visitor_key, visited_on)
             DO UPDATE SET views = site_visits.views + 1, updated_at = EXCLUDED.updated_at`,
            [
                visitorKeyOf(visitorId),
                now.setZone(statistics.timezone).toISODate(),
                now.toJSDate(),
                now.toJSDate(),
            ]
        )
    }

    /**
     * Mengembalikan false bila situsnya tidak ada atau sudah dihapus (klik tidak dicatat).
     */
    async recordClick(visitorId: string, domainId: number): Promise<boolean> {
        const domain = await db
            .from('domains')
            .where('id', domainId)
            .whereNull('deleted_at')
            .first()

        if (!domain) {
            return false
        }

        const visitorKey = visitorKeyOf(visitorId)
        const now = DateTime.now()
        const recentClick = await db
            .from('domain_clicks')
            .where('domain_id', domainId)
            .where('visitor_key', visitorKey)
            .where('clicked_at', '>', now.minus({ seconds: DUPLICATE_CLICK_SECONDS }).toJSDate())
            .first()

        if (!recentClick) {
            await db.table('domain_clicks').insert({
                domain_id: domainId,
                visitor_key: visitorKey,
                // Status promosi diambil dari data situs, bukan dari kiriman browser yang bisa dipalsukan.
                is_promoted: Boolean(domain.is_promoted),
                clicked_at: now.toJSDate(),
                created_at: now.toJSDate(),
                updated_at: now.toJSDate(),
            })
        }

        return true
    }
}
