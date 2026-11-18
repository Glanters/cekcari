import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [
        adonisjs({
            entryPoints: ['resources/css/app.css', 'resources/js/search.js', 'resources/js/panel.js'],
            reload: ['resources/views/**/*.edge'],
            // Harus sama dengan config/vite.ts; service worker (public/sw.js) juga menyimpan berkas dari /build.
            buildDirectory: 'public/build',
            assetsUrl: '/build',
        }),
        // Gambar di public/ (mis. /images/brand/...) dirujuk apa adanya, tidak ikut dibundel Vite.
        vue({ template: { transformAssetUrls: { base: null, includeAbsolute: false } } }),
        tailwindcss(),
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) },
    },
})
