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
        }),
        vue(),
        tailwindcss(),
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) },
    },
})
