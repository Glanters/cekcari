import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SearchService, { HIGHLIGHT_END, HIGHLIGHT_START } from '#services/search_service'
import { presentSearchHit } from '#presenters/search_result_presenter'
import { DEFAULT_PER_PAGE, searchMessages, searchResultsValidator } from '#validators/search_validator'
import { paginated } from '#support/api_response'

@inject()
export default class SearchResultsController {
    constructor(private searchService: SearchService) {}

    async index(ctx: HttpContext) {
        const input = await ctx.request.validateUsing(searchResultsValidator, { messagesProvider: searchMessages() })

        const outcome = await this.searchService.search(input.q, input.page ?? 1, input.per_page ?? DEFAULT_PER_PAGE, input.seed ?? null)

        return paginated(ctx, 'Hasil pencarian berhasil diambil', outcome.hits.map(presentSearchHit), outcome.pagination, {
            promoted: outcome.promoted ? presentSearchHit(outcome.promoted) : null,
            is_fuzzy: outcome.isFuzzy,
            highlight: { start: HIGHLIGHT_START, end: HIGHLIGHT_END },
        })
    }
}
