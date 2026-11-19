import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'

const SpaPagesController = () => import('#controllers/SpaPagesController')
const CrawlerFilesController = () => import('#controllers/CrawlerFilesController')

/**
 * Rute catch-all dibatasi lewat segmen pertamanya, bukan lewat urutan pendaftaran: router mencocokkan
 * rute sesuai urutan daftar, sedangkan berkas rute modul lain bisa selesai dimuat setelah berkas ini.
 * /api/..., /build/..., dan /up tidak pernah dijawab dengan kerangka SPA. Berkas di public/
 * (manifest, sw.js, ikon) sudah dilayani middleware static sebelum router.
 */
const SINGLE_SEGMENT = { match: /^(?!up$).+$/ }
const FIRST_OF_MANY_SEGMENTS = { match: /^(?!(api|build)$).+$/ }

// Domain pencarian: hanya halaman yang benar-benar ada yang dijawab 200, selebihnya 404,
// agar mesin pencari tidak mengindeks halaman kosong.
router
    .group(() => {
        router.get('/robots.txt', [CrawlerFilesController, 'searchRobots'])
        router.get('/sitemap.xml', [CrawlerFilesController, 'searchSitemap'])
        router.get('/', [SpaPagesController, 'searchHome'])
        router.get('/cari', [SpaPagesController, 'searchResults'])
        router.get('/pasang-aplikasi', [SpaPagesController, 'installGuide'])
        router.get('/:section', [SpaPagesController, 'searchNotFound']).where('section', SINGLE_SEGMENT).as('search_pages.not_found')
        router
            .get('/:section/*', [SpaPagesController, 'searchNotFound'])
            .where('section', FIRST_OF_MANY_SEGMENTS)
            .as('search_pages.not_found_nested')
    })
    .domain(domains.search)

// Domain panel: semua halaman ditangani Vue Router, dan seluruhnya tertutup untuk mesin pencari.
router
    .group(() => {
        router.get('/robots.txt', [CrawlerFilesController, 'panelRobots'])
        router.get('/', [SpaPagesController, 'panel']).as('panel_pages.home')
        router.get('/:section', [SpaPagesController, 'panel']).where('section', SINGLE_SEGMENT).as('panel_pages.single')
        router.get('/:section/*', [SpaPagesController, 'panel']).where('section', FIRST_OF_MANY_SEGMENTS).as('panel_pages.nested')
    })
    .domain(domains.panel)
