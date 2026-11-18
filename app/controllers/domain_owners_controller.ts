import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { PERMISSIONS, authorize } from '#services/permissions'
import { paginated, paginationMeta, paginationOf } from '#support/api_response'
import { containsPattern } from '#support/like_pattern'
import { domainOwnerIndexValidator } from '#validators/domain_validator'

// Pilihan pemilik di form tambah situs cukup beberapa nama teratas; selebihnya dipersempit lewat pencarian.
const MAX_OWNERS_PER_PAGE = 20

/**
 * Daftar member aktif yang bisa dijadikan pemilik situs oleh superadmin (domains.manage_all).
 */
export default class DomainOwnersController {
    async index(ctx: HttpContext) {
        await authorize(ctx.auth.getUserOrFail(), PERMISSIONS.manageAllDomains)

        const { q } = await ctx.request.validateUsing(domainOwnerIndexValidator)
        const { page, perPage } = paginationOf(ctx, MAX_OWNERS_PER_PAGE, MAX_OWNERS_PER_PAGE)
        const keyword = q ?? ''

        const paginator = await User.query()
            .whereNotNull('activated_at')
            .if(keyword !== '', (query) =>
                query.where((match) =>
                    match
                        .whereILike('name', containsPattern(keyword))
                        .orWhereILike('email', containsPattern(keyword))
                )
            )
            .orderBy('name')
            .orderBy('id')
            .paginate(page, perPage)

        const items = paginator
            .all()
            .map((owner) => ({ id: owner.id, name: owner.name, email: owner.email }))

        return paginated(ctx, 'Data pemilik berhasil diambil', items, paginationMeta(paginator))
    }
}
