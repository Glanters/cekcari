import type { HttpContext } from '@adonisjs/core/http'
import { seo } from '#config/cekcari'

/**
 * robots.txt dan sitemap.xml dibuat per domain: domain pencarian terbuka untuk mesin pencari,
 * domain panel ditutup seluruhnya.
 */
export default class CrawlerFilesController {
    async searchRobots({ response }: HttpContext) {
        const lines = seo.isIndexingAllowed
            ? [
                  'User-agent: *',
                  'Allow: /',
                  'Disallow: /api/',
                  '',
                  `Sitemap: ${seo.searchUrl}/sitemap.xml`,
              ]
            : ['User-agent: *', 'Disallow: /']

        return response
            .header('Content-Type', 'text/plain; charset=UTF-8')
            .send(`${lines.join('\n')}\n`)
    }

    async panelRobots({ response }: HttpContext) {
        return response
            .header('Content-Type', 'text/plain; charset=UTF-8')
            .send('User-agent: *\nDisallow: /\n')
    }

    // Hanya beranda yang layak diindeks; halaman hasil pencarian sengaja tidak dimasukkan.
    async searchSitemap({ response, view }: HttpContext) {
        const sitemap = await view.render('sitemap', { urls: [`${seo.searchUrl}/`] })

        return response.header('Content-Type', 'application/xml; charset=UTF-8').send(sitemap)
    }
}
