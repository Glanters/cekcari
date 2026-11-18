import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, manyToMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Page from '#models/page'
import Tag from '#models/tag'

export const CRAWL_STATUSES = ['pending', 'crawling', 'done', 'failed', 'redirected'] as const
export type CrawlStatus = (typeof CRAWL_STATUSES)[number]

export default class Domain extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare userId: number

    @column()
    declare url: string

    @column()
    declare host: string

    @column()
    declare title: string

    @column()
    declare description: string

    @column()
    // Alamat ikon di situs pemiliknya; ditampilkan langsung dari sana, tidak disalin ke server.
    declare logoUrl: string | null

    @column()
    declare isPromoted: boolean

    @column()
    declare crawlStatus: CrawlStatus

    @column()
    declare redirectedTo: string | null

    @column.dateTime()
    declare lastCrawledAt: DateTime | null

    @column()
    declare createdBy: number | null

    @column()
    declare updatedBy: number | null

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    // Penghapusan lunak: data domain tidak benar-benar hilang (standar perusahaan).
    @column.dateTime()
    declare deletedAt: DateTime | null

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>

    @hasMany(() => Page)
    declare pages: HasMany<typeof Page>

    @manyToMany(() => Tag, { pivotTable: 'domain_tag', pivotTimestamps: true })
    declare tags: ManyToMany<typeof Tag>

    static active = scope((query) => {
        query.whereNull('domains.deleted_at')
    })
}
