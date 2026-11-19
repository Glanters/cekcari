import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import encryption from '@adonisjs/core/services/encryption'
import Domain from '#models/domain'
import Role from '#models/role'
import { ROLES, type UserRole } from '#services/permissions'

function encryptSecret(value: string | null): string | null {
    return value === null ? null : encryption.encrypt(value)
}

// Gagal didekripsi (mis. APP_KEY berganti) harus menjadi galat, bukan null: null berarti
// "belum memasang 2FA" sehingga login akan meminta pemasangan ulang tanpa bukti kepemilikan.
function decryptSecret(value: string | null): string | null {
    if (value === null) {
        return null
    }

    const secret = encryption.decrypt<string>(value)

    if (secret === null) {
        throw new Error('Kunci 2FA tersimpan tidak dapat didekripsi dengan APP_KEY saat ini.')
    }

    return secret
}

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

    // Disimpan terenkripsi dengan APP_KEY; tidak pernah dikirim ke browser.
    @column({ serializeAs: null, prepare: encryptSecret, consume: decryptSecret })
    declare twoFactorSecret: string | null

    // Berisi hash, bukan recovery code aslinya.
    @column({
        serializeAs: null,
        prepare: (value: string[] | null) => (value === null ? null : JSON.stringify(value)),
    })
    declare twoFactorRecoveryCodes: string[] | null

    @column.dateTime()
    declare twoFactorConfirmedAt: DateTime | null

    // bigint dibaca driver pg sebagai teks.
    @column({
        serializeAs: null,
        consume: (value: string | null) => (value === null ? null : Number(value)),
    })
    declare twoFactorLastStep: number | null

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

    @manyToMany(() => Role, { pivotTable: 'role_user', pivotTimestamps: true })
    declare roles: ManyToMany<typeof Role>

    get isActive(): boolean {
        return this.activatedAt !== null
    }

    // Akun yang baru dibuat (new User()) belum punya nilai kolom ini: undefined, bukan null.
    // Keduanya berarti 2FA belum dipasang, jadi tidak boleh dibandingkan dengan null saja.
    get hasConfirmedTwoFactor(): boolean {
        return Boolean(this.twoFactorConfirmedAt) && Boolean(this.twoFactorSecret)
    }

    /**
     * Peran untuk ditampilkan; relasi roles wajib sudah dimuat (load/preload). Setiap akun yang
     * bukan superadmin diperlakukan sebagai member. Untuk memeriksa hak akses pakai
     * #services/permissions, bukan getter ini.
     */
    get role(): UserRole {
        if (!('roles' in this.$preloaded)) {
            throw new Error('Relasi roles harus dimuat sebelum membaca peran pengguna.')
        }

        return this.roles.some((role) => role.name === ROLES.superadmin)
            ? ROLES.superadmin
            : ROLES.member
    }
}
