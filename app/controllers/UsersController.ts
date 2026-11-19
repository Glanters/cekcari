import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { PERMISSIONS, authorize } from '#services/permissions'
import { presentManagedUser } from '#presenters/userPresenter'
import { paginated, paginationMeta, paginationOf } from '#support/apiResponse'
import { containsPattern } from '#support/likePattern'
import {
    USER_STATUS_ACTIVE,
    USER_STATUS_PENDING,
    userIndexValidator,
} from '#validators/userManagementValidator'

export default class UsersController {
    async index(ctx: HttpContext) {
        await authorize(ctx.auth.getUserOrFail(), PERMISSIONS.manageUsers)

        const { q, status } = await ctx.request.validateUsing(userIndexValidator)
        const { page, perPage } = paginationOf(ctx)
        const keyword = q ?? ''

        const paginator = await User.query()
            .preload('roles')
            .withCount('domains', (query) => query.whereNull('deleted_at'))
            .if(keyword !== '', (query) =>
                query.where((match) =>
                    match
                        .whereILike('name', containsPattern(keyword))
                        .orWhereILike('email', containsPattern(keyword))
                )
            )
            .if(status === USER_STATUS_PENDING, (query) => query.whereNull('activated_at'))
            .if(status === USER_STATUS_ACTIVE, (query) => query.whereNotNull('activated_at'))
            // Akun yang menunggu aktivasi ditaruh paling atas karena itulah yang perlu ditindaklanjuti.
            .orderByRaw('activated_at IS NOT NULL')
            .orderBy('created_at', 'desc')
            .paginate(page, perPage)

        const pendingCount = await User.query()
            .whereNull('activated_at')
            .count('* as total')
            .firstOrFail()

        return paginated(
            ctx,
            'Data pengguna berhasil diambil',
            paginator.all().map(presentManagedUser),
            paginationMeta(paginator),
            {
                pending_count: Number(pendingCount.$extras.total),
            }
        )
    }
}
