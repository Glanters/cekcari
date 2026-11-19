import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { statistics } from '#config/cekcari'

export const STATISTICS_RANGES = ['today', '7d', '30d', 'all'] as const
export type StatisticsRange = (typeof STATISTICS_RANGES)[number]

export type DomainClickRow = {
    id: number
    title: string
    url: string
    host: string
    logo_url: string | null
    owner_id: number
    owner_name: string
    owner_email: string
    clicks: number
    unique_clicks: number
}

/**
 * Awal rentang dihitung pada pukul 00.00 waktu Indonesia; "7 hari" berarti hari ini dan 6 hari sebelumnya.
 */
export function rangeStart(range: StatisticsRange, now = DateTime.now()): DateTime | null {
    const today = now.setZone(statistics.timezone).startOf('day')

    switch (range) {
        case 'today':
            return today
        case '7d':
            return today.minus({ days: 6 })
        case '30d':
            return today.minus({ days: 29 })
        case 'all':
            return null
    }
}

/**
 * ownerId null berarti semua situs (superadmin); selain itu hanya situs milik akun tersebut.
 */
export default class StatisticsService {
    async visitorTotals(range: StatisticsRange): Promise<{ unique: number; visits: number }> {
        const start = rangeStart(range)
        const row = await db
            .from('site_visits')
            .if(start !== null, (query) => query.where('visited_on', '>=', start!.toISODate()!))
            .select(
                db.raw('count(distinct visitor_key) as unique_visitors'),
                db.raw('coalesce(sum(views), 0) as visits')
            )
            .first()

        return { unique: Number(row?.unique_visitors ?? 0), visits: Number(row?.visits ?? 0) }
    }

    async clickTotals(
        ownerId: number | null,
        range: StatisticsRange
    ): Promise<{ total: number; unique: number }> {
        const start = rangeStart(range)
        const row = await db
            .from('domain_clicks as c')
            .join('domains as d', 'd.id', 'c.domain_id')
            .whereNull('d.deleted_at')
            .if(ownerId !== null, (query) => query.where('d.user_id', ownerId!))
            .if(start !== null, (query) => query.where('c.clicked_at', '>=', start!.toJSDate()))
            .select(
                db.raw('count(*) as total_clicks'),
                db.raw('count(distinct c.visitor_key) as unique_clicks')
            )
            .first()

        return { total: Number(row?.total_clicks ?? 0), unique: Number(row?.unique_clicks ?? 0) }
    }

    /**
     * Semua situs (termasuk yang belum pernah diklik), urut dari klik terbanyak.
     */
    async domainClicks(
        ownerId: number | null,
        range: StatisticsRange,
        page: number,
        perPage: number
    ): Promise<{ rows: DomainClickRow[]; total: number }> {
        const start = rangeStart(range)
        const scopedDomains = () =>
            db
                .from('domains as d')
                .whereNull('d.deleted_at')
                .if(ownerId !== null, (query) => query.where('d.user_id', ownerId!))

        const countRow = await scopedDomains().count('* as total').first()
        const rows = await scopedDomains()
            .join('users as u', 'u.id', 'd.user_id')
            .leftJoin('domain_clicks as c', (join) => {
                join.on('c.domain_id', '=', 'd.id')

                if (start !== null) {
                    join.andOnVal('c.clicked_at', '>=', start.toJSDate())
                }
            })
            .groupBy('d.id', 'u.id')
            .select(
                'd.id',
                'd.title',
                'd.url',
                'd.host',
                'd.logo_url',
                'u.id as owner_id',
                'u.name as owner_name',
                'u.email as owner_email',
                db.raw('count(c.id) as clicks'),
                db.raw('count(distinct c.visitor_key) as unique_clicks')
            )
            .orderBy('clicks', 'desc')
            .orderBy('d.id', 'asc')
            .limit(perPage)
            .offset((page - 1) * perPage)

        return {
            rows: rows.map((row: DomainClickRow) => ({
                ...row,
                id: Number(row.id),
                owner_id: Number(row.owner_id),
                clicks: Number(row.clicks),
                unique_clicks: Number(row.unique_clicks),
            })),
            total: Number(countRow?.total ?? 0),
        }
    }
}
