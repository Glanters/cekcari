import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
    NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
    PORT: Env.schema.number(),
    HOST: Env.schema.string({ format: 'host' }),
    LOG_LEVEL: Env.schema.string(),

    APP_NAME: Env.schema.string(),
    APP_KEY: Env.schema.secret(),

    // Dua domain: pencarian publik dan panel pemilik (nama host tanpa skema dan port).
    SEARCH_DOMAIN: Env.schema.string(),
    PANEL_DOMAIN: Env.schema.string(),
    // Alamat lengkap domain pencarian untuk canonical, sitemap, dan Open Graph.
    SEARCH_URL: Env.schema.string({ format: 'url', tld: false }),
    GOOGLE_SITE_VERIFICATION: Env.schema.string.optional(),
    // false di server uji (mis. cari.salahmu.fun) agar Google tidak mengindeks salinan situs.
    SEO_ALLOW_INDEXING: Env.schema.boolean.optional(),

    SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'redis'] as const),
    LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),

    DB_HOST: Env.schema.string({ format: 'host' }),
    DB_PORT: Env.schema.number(),
    DB_USER: Env.schema.string(),
    DB_PASSWORD: Env.schema.secret.optional(),
    DB_DATABASE: Env.schema.string(),

    REDIS_HOST: Env.schema.string({ format: 'host' }),
    REDIS_PORT: Env.schema.number(),
    REDIS_PASSWORD: Env.schema.secret.optional(),
    REDIS_KEY_PREFIX: Env.schema.string.optional(),


    CRAWLER_MAX_PAGES: Env.schema.number.optional(),
    CRAWLER_USER_AGENT: Env.schema.string.optional(),
    CRAWLER_DELAY_MS: Env.schema.number.optional(),

    // Login terpusat. "dummy" hanya untuk masa uji dan diabaikan di production.
    ACCOUNTCENTER_DRIVER: Env.schema.enum.optional(['http', 'dummy'] as const),
    ACCOUNTCENTER_URI: Env.schema.string.optional(),
    ACCOUNTCENTER_NAME: Env.schema.string.optional(),
    ACCOUNTCENTER_SECRET: Env.schema.secret.optional(),
    ACCOUNTCENTER_TIMEOUT_MS: Env.schema.number.optional(),
    ACCOUNTCENTER_DUMMY_PASSWORD: Env.schema.secret.optional(),
    // Hanya untuk server uji (mis. cari.salahmu.fun) selama Account Center asli belum tersambung.
    ACCOUNTCENTER_DUMMY_IN_PRODUCTION: Env.schema.boolean.optional(),
    ACCOUNTCENTER_SUPERADMIN_EMAILS: Env.schema.string.optional(),

    // Proxy di depan aplikasi (dipisah koma, boleh CIDR). Jangan "*": IP bisa dipalsukan.
    TRUSTED_PROXIES: Env.schema.string.optional(),
})
