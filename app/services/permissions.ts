import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Role from '#models/role'
import type User from '#models/user'

/**
 * Peran dan izin panel (pengganti Spatie Laravel Permission). Endpoint memeriksa izin lewat
 * authorize()/hasPermission(), bukan nama peran, sehingga peran baru cukup diberi izin di tabel.
 */
export const ROLES = {
    superadmin: 'superadmin',
    member: 'member',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export const USER_ROLES: UserRole[] = Object.values(ROLES)

export const PERMISSIONS = {
    manageUsers: 'manage-users',
    manageSecurity: 'manage-security',
    // Situs milik semua member: melihat, dan menambah/mengubah/menghapus.
    viewAllDomains: 'domains.view_all',
    manageAllDomains: 'domains.manage_all',
    // Jumlah pengunjung situs dan klik semua situs (member hanya melihat klik situs miliknya).
    viewAllStatistics: 'statistics.view_all',
} as const

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Kode E_AUTHORIZATION_FAILURE dijawab exception handler sebagai 403 dalam bentuk standar.
 */
export class AuthorizationException extends Exception {
    static status = 403
    static code = 'E_AUTHORIZATION_FAILURE'
}

// Menerima string biasa supaya modul lain bisa memanggilnya tanpa mengimpor tipe; nama yang
// tidak terdaftar di tabel permissions selalu menghasilkan false.
export async function hasPermission(user: User, permission: string): Promise<boolean> {
    const row = await db
        .from('role_user')
        .join('permission_role', 'permission_role.role_id', 'role_user.role_id')
        .join('permissions', 'permissions.id', 'permission_role.permission_id')
        .where('role_user.user_id', user.id)
        .where('permissions.name', permission)
        .select('permissions.id')
        .first()

    return row !== null
}

/**
 * Melempar 403 bila pengguna tidak punya izin ini. Dipanggil di awal setiap endpoint yang dibatasi.
 */
export async function authorize(user: User, permission: PermissionName): Promise<void> {
    if (!(await hasPermission(user, permission))) {
        throw new AuthorizationException('Anda tidak berhak mengakses data ini.')
    }
}

export async function isSuperadmin(user: User): Promise<boolean> {
    const row = await db
        .from('role_user')
        .join('roles', 'roles.id', 'role_user.role_id')
        .where('role_user.user_id', user.id)
        .where('roles.name', ROLES.superadmin)
        .select('roles.id')
        .first()

    return row !== null
}

/**
 * Setiap akun hanya punya satu peran; peran lama diganti.
 */
export async function assignRole(
    user: User,
    roleName: UserRole,
    trx: TransactionClientContract
): Promise<void> {
    const role = await Role.query({ client: trx }).where('name', roleName).firstOrFail()

    user.useTransaction(trx)
    await user.related('roles').sync([role.id])
}
