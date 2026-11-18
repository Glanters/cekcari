import limiter from '@adonisjs/limiter/services/main'

/**
 * Batas permintaan per IP (atau per akun untuk aksi yang membuat server mengakses situs luar).
 */
export const throttleSearch = limiter.define('search', (ctx) => limiter.allowRequests(120).every('1 minute').usingKey(`search:${ctx.request.ip()}`))

export const throttleAuth = limiter.define('auth', (ctx) => limiter.allowRequests(10).every('1 minute').usingKey(`auth:${ctx.request.ip()}`))

// 30/menit cukup untuk menambahkan satu daftar berisi maksimal 20 situs sekaligus.
export const throttleRemoteFetch = limiter.define('remote-fetch', (ctx) => {
    const key = ctx.auth.user ? `user:${ctx.auth.user.id}` : `ip:${ctx.request.ip()}`

    return limiter.allowRequests(30).every('1 minute').usingKey(`remote-fetch:${key}`)
})
