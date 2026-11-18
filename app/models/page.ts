import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Domain from '#models/domain'

export default class Page extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare domainId: number

    @column()
    declare url: string

    @column()
    declare title: string | null

    @column()
    declare description: string | null

    @column()
    declare content: string | null

    @column()
    declare httpStatus: number

    @column.dateTime()
    declare crawledAt: DateTime

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    @belongsTo(() => Domain)
    declare domain: BelongsTo<typeof Domain>
}
