import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { middleware } from '#start/kernel'

const StatisticsController = () => import('#controllers/statistics_controller')

// Semua akun yang masuk; cakupan datanya (semua situs atau situs sendiri) diputuskan di controller.
router
    .group(() => {
        router.get('statistics', [StatisticsController, 'index'])
    })
    .prefix('/api/v1')
    .domain(domains.panel)
    .use([middleware.auth(), middleware.active(), middleware.ipWhitelist()])
