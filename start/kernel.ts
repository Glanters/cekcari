import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
    () => import('#middleware/ContainerBindingsMiddleware'),
    () => import('#middleware/SecurityHeadersMiddleware'),
    () => import('@adonisjs/static/static_middleware'),
    () => import('@adonisjs/vite/vite_middleware'),
])

router.use([
    () => import('@adonisjs/core/bodyparser_middleware'),
    // Sesi dan CSRF hanya di panel; domain pencarian publik tanpa cookie (lihat kedua middleware ini).
    () => import('#middleware/PanelSessionMiddleware'),
    () => import('#middleware/DomainShieldMiddleware'),
    () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/**
 * Middleware bernama. Grup panel memakai urutan: auth → active → ipWhitelist.
 */
export const middleware = router.named({
    auth: () => import('#middleware/AuthMiddleware'),
    active: () => import('#middleware/EnsureUserIsActiveMiddleware'),
    ipWhitelist: () => import('#middleware/EnsureIpIsWhitelistedMiddleware'),
})
