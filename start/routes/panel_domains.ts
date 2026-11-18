import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { middleware } from '#start/kernel'
import { throttleRemoteFetch } from '#start/limiter'

const DomainsController = () => import('#controllers/domains_controller')
const DomainCrawlsController = () => import('#controllers/domain_crawls_controller')
const DomainPromotionsController = () => import('#controllers/domain_promotions_controller')
const DomainOwnersController = () => import('#controllers/domain_owners_controller')

// API situs milik member: hanya di domain panel. Hak akses per domain diperiksa di setiap controller.
router
    .group(() => {
        router.get('domains', [DomainsController, 'index'])
        router.get('domains/:id', [DomainsController, 'show']).where('id', router.matchers.number())
        router
            .delete('domains/:id', [DomainsController, 'destroy'])
            .where('id', router.matchers.number())
        router
            .put('domains/:id/promotion', [DomainPromotionsController, 'update'])
            .where('id', router.matchers.number())
        router.get('domain-owners', [DomainOwnersController, 'index'])

        // Menambah atau mengganti link membuat server mengambil data dari situs luar, jadi dibatasi.
        router
            .group(() => {
                router.post('domains', [DomainsController, 'store'])
                router
                    .put('domains/:id', [DomainsController, 'update'])
                    .where('id', router.matchers.number())
                router
                    .post('domains/:id/crawls', [DomainCrawlsController, 'store'])
                    .where('id', router.matchers.number())
            })
            .use(throttleRemoteFetch)
    })
    .domain(domains.panel)
    .prefix('/api/v1')
    .use([middleware.auth(), middleware.active(), middleware.ipWhitelist()])
