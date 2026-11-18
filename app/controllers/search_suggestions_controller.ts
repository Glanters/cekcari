import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SearchService from '#services/search_service'
import { MIN_SUGGESTION_KEYWORD_LENGTH, searchMessages, searchSuggestionsValidator } from '#validators/search_validator'
import { success } from '#support/api_response'

@inject()
export default class SearchSuggestionsController {
    constructor(private searchService: SearchService) {}

    async index(ctx: HttpContext) {
        const input = await ctx.request.validateUsing(searchSuggestionsValidator, { messagesProvider: searchMessages() })
        const keyword = input.q ?? ''

        // Satu huruf terlalu umum untuk menghasilkan saran yang berguna.
        const suggestions = [...keyword].length >= MIN_SUGGESTION_KEYWORD_LENGTH ? await this.searchService.suggest(keyword) : []

        return success(ctx, 'Saran pencarian berhasil diambil', { items: suggestions })
    }
}
