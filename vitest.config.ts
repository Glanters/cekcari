import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest hanya menguji fungsi murni di frontend; terpisah dari vite.config.ts milik Adonis.
export default defineConfig({
    resolve: {
        alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) },
    },
    test: {
        include: ['resources/js/**/*.test.js'],
    },
})
