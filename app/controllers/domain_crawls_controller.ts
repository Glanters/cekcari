import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { presentPanelDomainById } from '#presenters/panel_domain_presenter'
import { authorizeDomainManagement, findPanelDomain } from '#services/domain_access'
import DomainService from '#services/domain_service'
import { success } from '#support/api_response'

@inject()
export default class DomainCrawlsController {
    constructor(private readonly domainService: DomainService) {}

    async store(ctx: HttpContext) {
        const editor = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainManagement(editor, domain)
        await this.domainService.requestCrawl(domain, editor)

        return success(
            ctx,
            'Pembaruan data berhasil dijadwalkan',
            await presentPanelDomainById(domain.id, editor),
            201
        )
    }
}
