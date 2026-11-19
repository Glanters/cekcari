import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { PERMISSIONS, hasPermission } from '#services/permissions'
import StatisticsService from '#services/StatisticsService'
import { paginated, paginationOf } from '#support/apiResponse'
import { statisticsIndexValidator } from '#validators/statisticsValidator'

/**
 * Superadmin: jumlah pengunjung situs dan klik semua situs. Member: klik situs miliknya saja,
 * tanpa angka pengunjung keseluruhan.
 */
@inject()
export default class StatisticsController {
    constructor(private readonly statistics: StatisticsService) {}

    async index(ctx: HttpContext) {
        const user = ctx.auth.getUserOrFail()
        const { range = '7d' } = await ctx.request.validateUsing(statisticsIndexValidator)
        const { page, perPage } = paginationOf(ctx, 20)
        const canViewAll = await hasPermission(user, PERMISSIONS.viewAllStatistics)
        const ownerId = canViewAll ? null : user.id

        const [visitors, clicks, domainClicks] = await Promise.all([
            canViewAll ? this.statistics.visitorTotals(range) : Promise.resolve(null),
            this.statistics.clickTotals(ownerId, range),
            this.statistics.domainClicks(ownerId, range, page, perPage),
        ])

        const items = domainClicks.rows.map((row) => ({
            id: row.id,
            title: row.title,
            url: row.url,
            host: row.host,
            logo_url: row.logo_url,
            clicks: row.clicks,
            unique_clicks: row.unique_clicks,
            owner: { id: row.owner_id, name: row.owner_name, email: row.owner_email },
        }))

        return paginated(
            ctx,
            'Statistik berhasil diambil',
            items,
            {
                page,
                per_page: perPage,
                total: domainClicks.total,
                last_page: Math.max(1, Math.ceil(domainClicks.total / perPage)),
            },
            { range, can_view_all: canViewAll, visitors, clicks }
        )
    }
}
