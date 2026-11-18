import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { throttleSearch } from '#start/limiter'

const SearchResultsController = () => import('#controllers/search_results_controller')
const SearchSuggestionsController = () => import('#controllers/search_suggestions_controller')

// API pencarian publik: hanya di domain pencarian.
router
    .group(() => {
        router.get('/search-results', [SearchResultsController, 'index'])
        router.get('/search-suggestions', [SearchSuggestionsController, 'index'])
    })
    .prefix('/api/v1')
    .domain(domains.search)
    .use(throttleSearch)
