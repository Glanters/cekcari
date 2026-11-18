import type { HttpContext } from '@adonisjs/core/http'
import { seo } from '#config/cekcari'

const SEARCH_ENTRY = 'resources/js/search.js'
const PANEL_ENTRY = 'resources/js/panel.js'
const MAX_KEYWORD_IN_TITLE = 60

type PageSeo = {
    title: string
    description: string
    canonical: string | null
    robots: string
    structuredData: string | null
}

/**
 * Mengirim kerangka SPA beserta tag SEO yang dirender di server, sehingga mesin pencari
 * mendapat judul, deskripsi, canonical, dan aturan index tanpa harus menjalankan JavaScript.
 */
export default class SpaPagesController {
    async searchHome(ctx: HttpContext) {
        return this.render(ctx, SEARCH_ENTRY, {
            title: seo.defaultTitle,
            description: seo.defaultDescription,
            canonical: `${seo.searchUrl}/`,
            robots: 'index, follow',
            structuredData: siteStructuredData(),
        })
    }

    // Halaman hasil pencarian internal tidak diindeks (anjuran Google), tetapi tautannya tetap boleh diikuti.
    async searchResults(ctx: HttpContext) {
        const query = ctx.request.qs().q
        const keyword = limitText(typeof query === 'string' ? query.trim() : '', MAX_KEYWORD_IN_TITLE)

        return this.render(ctx, SEARCH_ENTRY, {
            title: keyword !== '' ? `${keyword} — Hasil pencarian CekCari` : seo.defaultTitle,
            description: seo.defaultDescription,
            canonical: null,
            robots: 'noindex, follow',
            structuredData: null,
        })
    }

    // Alamat yang tidak dikenal di domain pencarian dijawab 404 sungguhan, bukan halaman kosong berstatus 200.
    async searchNotFound(ctx: HttpContext) {
        ctx.response.status(404)

        return this.render(ctx, SEARCH_ENTRY, {
            title: 'Halaman tidak ditemukan — CekCari',
            description: seo.defaultDescription,
            canonical: null,
            robots: 'noindex, follow',
            structuredData: null,
        })
    }

    // Panel pemilik tidak boleh muncul di Google sama sekali.
    async panel(ctx: HttpContext) {
        ctx.response.header('X-Robots-Tag', 'noindex, nofollow')

        return this.render(ctx, PANEL_ENTRY, {
            title: `Panel ${seo.siteName}`,
            description: `Panel pemilik situs ${seo.siteName}.`,
            canonical: null,
            robots: 'noindex, nofollow',
            structuredData: null,
        })
    }

    // Hanya domain pencarian yang bisa dipasang sebagai aplikasi (PWA); panel pemilik tetap situs biasa.
    private render(ctx: HttpContext, entry: string, page: PageSeo) {
        return ctx.view.render('app', {
            entry,
            page,
            isInstallable: entry === SEARCH_ENTRY,
            site: {
                name: seo.siteName,
                imageUrl: `${seo.searchUrl}${seo.imagePath}`,
                googleSiteVerification: seo.googleSiteVerification,
            },
        })
    }
}

// Data terstruktur agar Google mengenali nama situs "CekCari" beserta logonya.
function siteStructuredData(): string {
    const homeUrl = `${seo.searchUrl}/`

    const json = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            { '@type': 'WebSite', 'name': seo.siteName, 'url': homeUrl, 'inLanguage': 'id-ID' },
            { '@type': 'Organization', 'name': seo.siteName, 'url': homeUrl, 'logo': `${seo.searchUrl}${seo.imagePath}` },
        ],
    })

    // Setara JSON_HEX_TAG | JSON_HEX_AMP: teks JSON tidak bisa menutup tag <script> lebih awal.
    return json.replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026')
}

// Sama seperti Str::limit di Laravel: dipotong per karakter (bukan per byte) lalu diberi "...".
function limitText(value: string, limit: number): string {
    const characters = [...value]

    return characters.length <= limit ? value : `${characters.slice(0, limit).join('').trimEnd()}...`
}
