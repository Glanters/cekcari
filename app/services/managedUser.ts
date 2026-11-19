import User from '#models/user'

/**
 * Pengguna beserta peran dan jumlah situs aktifnya, dalam bentuk yang dibutuhkan presentManagedUser.
 */
export async function loadManagedUser(id: number): Promise<User> {
    return User.query()
        .where('id', id)
        .preload('roles')
        .withCount('domains', (query) => query.whereNull('deleted_at'))
        .firstOrFail()
}
