import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Domain from '#models/domain'

export default class User extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare name: string

    @column()
    declare email: string

    @column()
    declare avatarUrl: string | null

    @column.dateTime()
    declare activatedAt: DateTime | null

    @column.dateTime()
    declare lastLoginAt: DateTime | null

    // Terenkripsi (lihat layanan 2FA); tidak pernah dikirim ke browser.
    @column({ serializeAs: null })
    declare twoFactorSecret: string | null

    @column({ serializeAs: null, prepare: (value: string[] | null) => (value === null ? null : JSON.stringify(value)) })
    declare twoFactorRecoveryCodes: string[] | null

    @column.dateTime()
    declare twoFactorConfirmedAt: DateTime | null

    @column()
    declare createdBy: number | null

    @column()
    declare updatedBy: number | null

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    @hasMany(() => Domain)
    declare domains: HasMany<typeof Domain>

    get isActive(): boolean {
        return this.activatedAt !== null
    }

    get hasConfirmedTwoFactor(): boolean {
        return this.twoFactorConfirmedAt !== null && this.twoFactorSecret !== null
    }
}
