import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Pengaturan sistem berbentuk key-value yang bisa diubah dari dasbor tanpa deploy ulang.
 */
export default class AppSetting extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare key: string

    // Kolom jsonb: driver pg sudah mengubahnya menjadi nilai JavaScript saat dibaca.
    @column({ prepare: (value: unknown) => JSON.stringify(value) })
    declare value: unknown

    @column()
    declare createdBy: number | null

    @column()
    declare updatedBy: number | null

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    static async valueOf(key: string, defaultValue: unknown): Promise<unknown> {
        const setting = await AppSetting.findBy('key', key)

        return setting === null ? defaultValue : setting.value
    }

    static async store(key: string, value: unknown, changedById: number): Promise<void> {
        const setting = (await AppSetting.findBy('key', key)) ?? new AppSetting()

        setting.key = key
        setting.value = value
        setting.updatedBy = changedById
        setting.createdBy = setting.createdBy ?? changedById
        await setting.save()
    }
}
