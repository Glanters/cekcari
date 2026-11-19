import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SearchService, { HIGHLIGHT_END, HIGHLIGHT_START } from '#services/SearchService'
import { presentSearchHit } from '#presenters/searchResultPresenter'
import {
    DEFAULT_PER_PAGE,
    searchMessages,
    searchResultsValidator,
} from '#validators/searchValidator'
import { paginated } from '#support/apiResponse'

@inject()
export default class SearchResultsController {
    constructor(private searchService: SearchService) {}

    async index(ctx: HttpContext) {
        const input = await ctx.request.validateUsing(searchResultsValidator, {
            messagesProvider: searchMessages(),
        })

        const outcome = await this.searchService.search(
            input.q,
            input.page ?? 1,
            input.per_page ?? DEFAULT_PER_PAGE,
            input.seed ?? null,
            { allowCorrection: input.exact !== true }
        )

        return paginated(
            ctx,
            'Hasil pencarian berhasil diambil',
            outcome.hits.map(presentSearchHit),
            outcome.pagination,
            {
                promoted: outcome.promoted ? presentSearchHit(outcome.promoted) : null,
                is_fuzzy: outcome.isFuzzy,
                corrected_query: outcome.correctedQuery,
                highlight: { start: HIGHLIGHT_START, end: HIGHLIGHT_END },
            }
        )
    }
}
