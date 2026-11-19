import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { presentPanelDomainById } from '#presenters/panel_domain_presenter'
import { authorizeDomainManagement, findPanelDomain } from '#services/domain_access'
import DomainService from '#services/domain_service'
import { success } from '#support/api_response'
import { domainDetailsValidator } from '#validators/domain_validator'

/**
 * Deskripsi dan tag yang tampil di CekCari, diubah oleh pemilik link atau superadmin.
 */
@inject()
export default class DomainDetailsController {
    constructor(private readonly domainService: DomainService) {}

    async update(ctx: HttpContext) {
        const editor = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainManagement(editor, domain)

        const details = await ctx.request.validateUsing(domainDetailsValidator)

        await this.domainService.updateDetails(domain, editor, details)

        return success(
            ctx,
            'Deskripsi dan tag disimpan',
            await presentPanelDomainById(domain.id, editor)
        )
    }
}
