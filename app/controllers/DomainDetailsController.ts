import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { presentPanelDomainById } from '#presenters/panelDomainPresenter'
import { authorizeDomainManagement, findPanelDomain } from '#services/domainAccess'
import DomainService from '#services/DomainService'
import { success } from '#support/apiResponse'
import { domainDetailsValidator } from '#validators/domainValidator'

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
