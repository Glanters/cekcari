import { defineConfig } from '@adonisjs/shield'
import { storage } from '#config/cekcari'

const shieldConfig = defineConfig({
    csp: {
        enabled: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", '@nonce', '@viteUrl'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', '@viteUrl'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            // Logo situs disimpan di bucket S3/Spaces.
            imgSrc: ["'self'", 'data:', new URL(storage.publicUrl).origin],
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
        exceptRoutes: [],
        enableXsrfCookie: true,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    xFrame: { enabled: true, action: 'DENY' },
    hsts: { enabled: true, maxAge: '180 days' },
    contentTypeSniffing: { enabled: true },
})

export default shieldConfig
