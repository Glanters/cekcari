import type User from '#models/user'

/**
 * Data akun yang sedang masuk (padanan UserResource di versi Laravel). `role` dipakai frontend
 * untuk menampilkan menu superadmin; hak akses tetap diperiksa server di setiap endpoint.
 * Relasi roles wajib sudah dimuat.
 */
export function presentUser(user: User) {
    return {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        avatar_url: user.avatarUrl,
        role: user.role,
        has_two_factor: user.hasConfirmedTwoFactor,
    }
}

/**
 * Data akun untuk halaman kelola pengguna (khusus superadmin). Relasi roles dan hitungan
 * domains (withCount) wajib sudah dimuat.
 */
export function presentManagedUser(user: User) {
    return {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        avatar_url: user.avatarUrl,
        role: user.role,
        is_active: user.isActive,
        has_two_factor: user.hasConfirmedTwoFactor,
        domains_count: Number(user.$extras.domains_count),
        activated_at: user.activatedAt?.toISO() ?? null,
        last_login_at: user.lastLoginAt?.toISO() ?? null,
        created_at: user.createdAt?.toISO() ?? null,
    }
}
