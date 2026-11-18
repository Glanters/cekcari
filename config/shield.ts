import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
    csp: {
        enabled: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", '@nonce', '@viteUrl'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', '@viteUrl'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
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
        // Pencatat kunjungan/klik dikirim lewat sendBeacon (tanpa header CSRF) dan tidak memakai sesi siapa pun.
        exceptRoutes: ['/api/v1/visits', '/api/v1/domain-clicks'],
        enableXsrfCookie: true,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    xFrame: { enabled: true, action: 'DENY' },
    hsts: { enabled: true, maxAge: '180 days' },
    contentTypeSniffing: { enabled: true },
})

export default shieldConfig
