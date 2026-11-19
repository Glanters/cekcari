import Domain from '#models/domain'
import type User from '#models/user'
import { AuthorizationException, PERMISSIONS, hasPermission } from '#services/permissions'

/**
 * Domain aktif (belum dihapus) beserta data yang dibutuhkan presentPanelDomain. Tidak ada → 404.
 */
export function panelDomainQuery() {
    return Domain.query()
        .withScopes((scopes) => scopes.active())
        .preload('user')
        .preload('tags', (query) => query.orderBy('domain_tag.id'))
        .withCount('pages')
}

export function findPanelDomain(id: number): Promise<Domain> {
    return panelDomainQuery().where('domains.id', id).firstOrFail()
}

// Pemilik selalu boleh; superadmin lewat izin domains.view_all / domains.manage_all.
export async function canViewDomain(user: User, domain: Domain): Promise<boolean> {
    return domain.userId === user.id || hasPermission(user, PERMISSIONS.viewAllDomains)
}

export async function canManageDomain(user: User, domain: Domain): Promise<boolean> {
    return domain.userId === user.id || hasPermission(user, PERMISSIONS.manageAllDomains)
}

export async function authorizeDomainView(user: User, domain: Domain): Promise<void> {
    if (!(await canViewDomain(user, domain))) {
        throw new AuthorizationException('Anda tidak berhak mengakses data ini.')
    }
}

export async function authorizeDomainManagement(user: User, domain: Domain): Promise<void> {
    if (!(await canManageDomain(user, domain))) {
        throw new AuthorizationException('Anda tidak berhak mengakses data ini.')
    }
}
