import { defineConfig } from '@adonisjs/vite'

// Folder /build juga dipakai service worker untuk menyimpan berkas aplikasi (lihat public/sw.js).
const viteBackendConfig = defineConfig({
    buildDirectory: 'public/build',
    manifestFile: 'public/build/manifest.json',
    assetsUrl: '/build',
    scriptAttributes: { defer: true },
})

export default viteBackendConfig
