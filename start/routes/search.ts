import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { throttleSearch } from '#start/limiter'

const SearchResultsController = () => import('#controllers/search_results_controller')
const VisitTrackingController = () => import('#controllers/visit_tracking_controller')

// API pencarian publik: hanya di domain pencarian.
router
    .group(() => {
        router.get('/search-results', [SearchResultsController, 'index'])
        // Statistik kunjungan dan klik, dikirim browser pengunjung lewat navigator.sendBeacon.
        router.post('/visits', [VisitTrackingController, 'storeVisit'])
        router.post('/domain-clicks', [VisitTrackingController, 'storeClick'])
    })
    .prefix('/api/v1')
    .domain(domains.search)
    .use(throttleSearch)
