import { sep } from 'node:path'
import { defineConfig } from '@adonisjs/static'

const ONE_YEAR_SECONDS = 31_536_000
const THIRTY_DAYS_SECONDS = 2_592_000

/**
 * Cache-Control per jenis berkas di public/:
 * - Hasil build Vite memakai nama ber-hash, jadi isinya tidak pernah berubah: simpan setahun.
 * - manifest build dan service worker harus selalu diperiksa ulang, karena keduanya yang memberi tahu
 *   browser bahwa ada versi baru.
 * - Huruf jarang berganti dan namanya tetap; bila diganti, ganti juga nama berkasnya.
 */
function cacheControlFor(filePath: string): string | null {
    const path = filePath.split(sep).join('/')

    if (path.endsWith('/build/manifest.json') || path.endsWith('/sw.js')) {
        return 'no-cache'
    }

    if (path.includes('/public/build/')) {
        return `public, max-age=${ONE_YEAR_SECONDS}, immutable`
    }

    if (path.includes('/public/fonts/')) {
        return `public, max-age=${THIRTY_DAYS_SECONDS}`
    }

    return null
}

/**
 * Configuration options to tweak the static files middleware.
 * The complete set of options are documented on the
 * official documentation website.
 *
 * https://docs.adonisjs.com/guides/basics/static-file-server
 */
const staticServerConfig = defineConfig({
    /**
     * Enable or disable the static file server middleware.
     */
    enabled: true,

    /**
     * Enable ETag headers for static files.
     * ETags help browsers cache files efficiently by comparing
     * file versions without re-downloading unchanged files.
     */
    etag: true,

    /**
     * Include Last-Modified headers in responses.
     * Allows browsers to use conditional requests for better caching.
     */
    lastModified: true,

    /**
     * How to handle dotfiles (files starting with .).
     * Ignore dotfiles and respond as if they do not exist (ignore/404).
     * Serve dotfiles normally with the allow mode.
     * Reject access to dotfiles with deny mode (403).
     */
    dotFiles: 'ignore',

    headers: (filePath) => {
        const cacheControl = cacheControlFor(filePath)

        return cacheControl === null ? {} : { 'Cache-Control': cacheControl }
    },
})

export default staticServerConfig
