import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

const sessionConfig = defineConfig({
    enabled: true,
    cookieName: 'cekcari-session',
    clearWithBrowser: false,
    age: '2h',
    // Cookie hanya untuk host yang menyetelnya, jadi sesi panel tidak pernah terkirim ke domain pencarian.
    cookie: {
        path: '/',
        httpOnly: true,
        secure: app.inProduction,
        sameSite: 'lax',
    },
    store: env.get('SESSION_DRIVER'),
    stores: {
        cookie: stores.cookie(),
        redis: stores.redis({ connection: 'main' }),
    },
})

export default sessionConfig
