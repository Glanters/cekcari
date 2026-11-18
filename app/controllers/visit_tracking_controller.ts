import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import VisitTracker from '#services/visit_tracker'
import { failure, success } from '#support/api_response'
import { trackClickValidator, trackVisitValidator } from '#validators/statistics_validator'

/**
 * Pencatatan kunjungan dan klik dari halaman pencarian publik. Tidak memakai sesi atau cookie;
 * pengunjung dikenali dari ID acak yang disimpan browsernya sendiri.
 */
@inject()
export default class VisitTrackingController {
    constructor(private readonly tracker: VisitTracker) {}

    async storeVisit(ctx: HttpContext) {
        const { visitor_id: visitorId } = await ctx.request.validateUsing(trackVisitValidator)
        await this.tracker.recordVisit(visitorId)

        return success(ctx, 'Kunjungan dicatat')
    }

    async storeClick(ctx: HttpContext) {
        const payload = await ctx.request.validateUsing(trackClickValidator)
        const isRecorded = await this.tracker.recordClick(
            payload.visitor_id,
            payload.domain_id,
            payload.is_promoted ?? false
        )

        return isRecorded
            ? success(ctx, 'Klik dicatat')
            : failure(ctx, 'Situs tidak ditemukan.', {}, 404)
    }
}
