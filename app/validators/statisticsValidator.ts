import vine from '@vinejs/vine'
import { STATISTICS_RANGES } from '#services/StatisticsService'

// Dikirim browser pengunjung lewat navigator.sendBeacon; ID pengunjung berupa UUID acak.
export const trackVisitValidator = vine.create({
    visitor_id: vine.string().uuid(),
})

export const trackClickValidator = vine.create({
    visitor_id: vine.string().uuid(),
    domain_id: vine.number().withoutDecimals().min(1),
})

export const statisticsIndexValidator = vine.create({
    range: vine.enum(STATISTICS_RANGES).optional(),
})
