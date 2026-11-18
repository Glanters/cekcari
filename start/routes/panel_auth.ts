import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { middleware } from '#start/kernel'
import { throttleAuth } from '#start/limiter'

const SessionsController = () => import('#controllers/sessions_controller')
const TwoFactorChallengesController = () => import('#controllers/two_factor_challenges_controller')
const TwoFactorSetupsController = () => import('#controllers/two_factor_setups_controller')
const ProfilesController = () => import('#controllers/profiles_controller')

/**
 * Login panel lewat Account Center, lalu (bila diwajibkan) kode 2FA atau pemasangan 2FA.
 * Hanya di domain panel, supaya sesi login tidak pernah ada di domain pencarian.
 */
router
    .group(() => {
        // SPA memanggil ini sebelum login untuk mendapatkan cookie XSRF-TOKEN; Shield menyetel
        // cookie tersebut di setiap permintaan, jadi jawabannya cukup kosong.
        router.get('csrf-token', ({ response }) => response.noContent())

        router
            .group(() => {
                router.post('sessions', [SessionsController, 'store'])
                router.post('two-factor-challenges', [TwoFactorChallengesController, 'store'])
                router.post('two-factor-setups', [TwoFactorSetupsController, 'store'])
            })
            .use(throttleAuth)

        router
            .group(() => {
                router.delete('sessions', [SessionsController, 'destroy'])
                router.get('profile', [ProfilesController, 'show'])
            })
            .use([middleware.auth(), middleware.active(), middleware.ipWhitelist()])
    })
    .prefix('/api/v1')
    .domain(domains.panel)
