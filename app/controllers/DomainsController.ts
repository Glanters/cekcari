import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { RemoteFetchException } from '#exceptions/RemoteFetchException'
import { presentPanelDomain, presentPanelDomainById } from '#presenters/panelDomainPresenter'
import {
    authorizeDomainManagement,
    authorizeDomainView,
    canManageDomain,
    findPanelDomain,
    panelDomainQuery,
} from '#services/domainAccess'
import DomainService from '#services/DomainService'
import { PERMISSIONS, authorize, hasPermission } from '#services/permissions'
import { failure, paginated, paginationMeta, paginationOf, success } from '#support/apiResponse'
import { containsPattern } from '#support/likePattern'
import {
    domainIndexValidator,
    prepareSiteUrl,
    storeDomainValidator,
    updateDomainValidator,
} from '#validators/domainValidator'

// Situs yang tidak bisa dibaca diperlakukan sebagai isian link yang belum benar.
function siteUnreachable(ctx: HttpContext, exception: RemoteFetchException) {
    return failure(ctx, exception.message, { url: [exception.message] }, 422)
}

@inject()
export default class DomainsController {
    constructor(private readonly domainService: DomainService) {}

    /**
     * Member melihat situs miliknya sendiri. Pengguna dengan izin domains.view_all (superadmin) melihat
     * situs semua member, kecuali meminta owner=mine; user_id menyaring satu member.
     */
    async index(ctx: HttpContext) {
        const viewer = ctx.auth.getUserOrFail()
        const { q, owner, user_id: ownerId } = await ctx.request.validateUsing(domainIndexValidator)
        const { page, perPage } = paginationOf(ctx)
        const keyword = q ?? ''
        const canViewAll = await hasPermission(viewer, PERMISSIONS.viewAllDomains)
        const canManageAll = await hasPermission(viewer, PERMISSIONS.manageAllDomains)
        const isListingAllOwners = canViewAll && owner !== 'mine'

        const paginator = await panelDomainQuery()
            .if(!isListingAllOwners, (query) => query.where('domains.user_id', viewer.id))
            .if(isListingAllOwners && ownerId !== undefined, (query) =>
                query.where('domains.user_id', ownerId as number)
            )
            .if(keyword !== '', (query) =>
                query.where((match) =>
                    match
                        .whereILike('domains.title', containsPattern(keyword))
                        .orWhereILike('domains.url', containsPattern(keyword))
                )
            )
            .orderBy('domains.created_at', 'desc')
            .orderBy('domains.id', 'desc')
            .paginate(page, perPage)

        const items = paginator
            .all()
            .map((domain) =>
                presentPanelDomain(domain, canManageAll || domain.userId === viewer.id)
            )

        return paginated(ctx, 'Data domain berhasil diambil', items, paginationMeta(paginator))
    }

    /**
     * Tanpa user_id situs menjadi milik pengguna yang menambahkan. Dengan user_id (hanya domains.manage_all)
     * situs didaftarkan atas nama member aktif tersebut.
     */
    async store(ctx: HttpContext) {
        const actor = ctx.auth.getUserOrFail()
        const requestedOwnerId = ctx.request.input('user_id')
        const hasRequestedOwner =
            requestedOwnerId !== undefined && requestedOwnerId !== null && requestedOwnerId !== ''

        if (hasRequestedOwner) {
            await authorize(actor, PERMISSIONS.manageAllDomains)
        }

        const ruleOwnerId =
            hasRequestedOwner && Number.isInteger(Number(requestedOwnerId))
                ? Number(requestedOwnerId)
                : actor.id
        const { url, user_id: ownerId } = await ctx.request.validateUsing(storeDomainValidator, {
            data: {
                user_id: hasRequestedOwner ? requestedOwnerId : undefined,
                url: prepareSiteUrl(ctx.request.input('url')),
            },
            meta: { ownerId: ruleOwnerId, domainId: null },
        })

        try {
            const domain = await this.domainService.create(actor, url, ownerId ?? actor.id)

            return success(
                ctx,
                'Domain berhasil ditambahkan',
                await presentPanelDomainById(domain.id, actor),
                201
            )
        } catch (error) {
            if (error instanceof RemoteFetchException) {
                return siteUnreachable(ctx, error)
            }

            throw error
        }
    }

    async show(ctx: HttpContext) {
        const viewer = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainView(viewer, domain)

        return success(
            ctx,
            'Data domain berhasil diambil',
            presentPanelDomain(domain, await canManageDomain(viewer, domain))
        )
    }

    async update(ctx: HttpContext) {
        const editor = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainManagement(editor, domain)

        const { url } = await ctx.request.validateUsing(updateDomainValidator, {
            data: { url: prepareSiteUrl(ctx.request.input('url')) },
            meta: { ownerId: domain.userId, domainId: domain.id },
        })

        try {
            await this.domainService.update(domain, editor, url)
        } catch (error) {
            if (error instanceof RemoteFetchException) {
                return siteUnreachable(ctx, error)
            }

            throw error
        }

        return success(
            ctx,
            'Domain berhasil diperbarui',
            await presentPanelDomainById(domain.id, editor)
        )
    }

    async destroy(ctx: HttpContext) {
        const editor = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainManagement(editor, domain)
        await this.domainService.delete(domain, editor)

        return success(ctx, 'Domain berhasil dihapus')
    }
}
