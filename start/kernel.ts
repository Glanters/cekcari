import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
    () => import('#middleware/container_bindings_middleware'),
    () => import('#middleware/security_headers_middleware'),
    () => import('@adonisjs/static/static_middleware'),
    () => import('@adonisjs/vite/vite_middleware'),
])

router.use([
    () => import('@adonisjs/core/bodyparser_middleware'),
    () => import('@adonisjs/session/session_middleware'),
    () => import('@adonisjs/shield/shield_middleware'),
    () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/**
 * Middleware bernama. Grup panel memakai urutan: auth → active → ipWhitelist.
 */
export const middleware = router.named({
    auth: () => import('#middleware/auth_middleware'),
    active: () => import('#middleware/ensure_user_is_active_middleware'),
    ipWhitelist: () => import('#middleware/ensure_ip_is_whitelisted_middleware'),
})
