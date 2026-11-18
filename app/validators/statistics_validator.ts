import vine from '@vinejs/vine'
import { STATISTICS_RANGES } from '#services/statistics_service'

// Dikirim browser pengunjung lewat navigator.sendBeacon; ID pengunjung berupa UUID acak.
export const trackVisitValidator = vine.create({
    visitor_id: vine.string().uuid(),
})

export const trackClickValidator = vine.create({
    visitor_id: vine.string().uuid(),
    domain_id: vine.number().withoutDecimals().min(1),
    is_promoted: vine.boolean().optional(),
})

export const statisticsIndexValidator = vine.create({
    range: vine.enum(STATISTICS_RANGES).optional(),
})
