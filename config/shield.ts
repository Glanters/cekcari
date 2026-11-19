import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
    csp: {
        enabled: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", '@nonce', '@viteUrl'],
            styleSrc: ["'self'", "'unsafe-inline'", '@viteUrl'],
            fontSrc: ["'self'", 'data:'],
            // Logo situs dimuat langsung dari domain pemiliknya, jadi alamat gambar luar diizinkan (hanya gambar).
            imgSrc: ["'self'", 'data:', 'https:', 'http:'],
            connectSrc: ["'self'", '@viteUrl', 'ws:', 'wss:'],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
        },
        reportOnly: false,
    },
    // SPA mengirim token dari cookie XSRF-TOKEN lewat header X-XSRF-TOKEN (axios melakukannya otomatis).
    csrf: {
        enabled: true,
        // Domain pencarian (termasuk pencatat kunjungan/klik via sendBeacon) memakai Shield tanpa CSRF;
        // lihat app/middleware/DomainShieldMiddleware.ts.
        exceptRoutes: [],
        enableXsrfCookie: true,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    xFrame: { enabled: true, action: 'DENY' },
    hsts: { enabled: true, maxAge: '180 days' },
    contentTypeSniffing: { enabled: true },
})

export default shieldConfig
