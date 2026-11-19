import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { presentPanelDomainById } from '#presenters/panelDomainPresenter'
import { authorizeDomainManagement, findPanelDomain } from '#services/domainAccess'
import { success } from '#support/apiResponse'
import { domainPromotionValidator } from '#validators/domainValidator'

export default class DomainPromotionsController {
    async update(ctx: HttpContext) {
        const editor = ctx.auth.getUserOrFail()
        const domain = await findPanelDomain(ctx.params.id)

        await authorizeDomainManagement(editor, domain)

        const { is_promoted: isPromoted } =
            await ctx.request.validateUsing(domainPromotionValidator)

        await db.transaction(async (trx) => {
            domain.useTransaction(trx)
            domain.merge({ isPromoted, updatedBy: editor.id })
            await domain.save()
        })

        return success(
            ctx,
            isPromoted ? 'Link sekarang dipromosikan' : 'Promosi link dihentikan',
            await presentPanelDomainById(domain.id, editor)
        )
    }
}
