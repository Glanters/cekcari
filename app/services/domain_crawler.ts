import { setTimeout as sleep } from 'node:timers/promises'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { crawler } from '#config/cekcari'
import { RemoteFetchException, SiteRedirectedException } from '#exceptions/remote_fetch_exception'
import type Domain from '#models/domain'
import type FetchedPage from '#services/fetched_page'
import Page from '#models/page'
import HtmlExtractor from '#services/html_extractor'
import RemotePageFetcher from '#services/remote_page_fetcher'
import RobotsRules from '#services/robots_rules'
import UrlResolver from '#services/url_resolver'
import { sliceChars } from '#support/characters'
import { originOf } from '#support/site_address'

const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 255

type CrawledPage = { url: string; links: string[] }

function hostWithoutWww(url: string): string {
    return (URL.parse(url)?.hostname ?? '').toLowerCase().replace(/^www\./, '')
}

@inject()
export default class DomainCrawler {
    constructor(
        private readonly fetcher: RemotePageFetcher,
        private readonly extractor: HtmlExtractor,
        private readonly urlResolver: UrlResolver
    ) {}

    /**
     * Menelusuri halaman-halaman satu entri (BFS) dan menyimpan isinya. Bila link yang didaftarkan
     * punya path (mis. dkwl.b-cdn.net/latoto-kl1), hanya halaman di bawah path itu yang ditelusuri,
     * karena host yang sama bisa berisi situs milik orang lain (CDN atau hosting bersama).
     *
     * Mengembalikan jumlah halaman yang berhasil disimpan.
     */
    async crawl(domain: Domain): Promise<number> {
        const robots = await this.loadRobotsRules(domain.url)
        const entryUrl = this.urlResolver.normalize(domain.url)

        if (entryUrl === null) {
            throw new RemoteFetchException(
                'Halaman yang didaftarkan tidak dapat dibaca oleh crawler.'
            )
        }

        const queue = [entryUrl]
        const visitedUrls = new Set<string>()
        const savedUrls: string[] = []

        while (queue.length > 0 && visitedUrls.size < crawler.maxPages) {
            const url = queue.shift() as string

            if (visitedUrls.has(url) || url.length > MAX_URL_LENGTH || !robots.isAllowed(url)) {
                continue
            }

            visitedUrls.add(url)
            const crawled = await this.crawlPage(domain, url, url === entryUrl)

            if (crawled === null) {
                continue
            }

            savedUrls.push(crawled.url)
            queue.push(
                ...crawled.links.filter(
                    (link) => !visitedUrls.has(link) && this.isInScope(link, domain)
                )
            )

            // Jeda antar-permintaan agar crawler tidak membebani server pemilik domain.
            if (crawler.delayMs > 0) {
                await sleep(crawler.delayMs)
            }
        }

        if (savedUrls.length === 0) {
            throw new RemoteFetchException(
                'Halaman yang didaftarkan tidak dapat dibaca oleh crawler.'
            )
        }

        await Page.query().where('domain_id', domain.id).whereNotIn('url', savedUrls).delete()

        return savedUrls.length
    }

    private async crawlPage(
        domain: Domain,
        url: string,
        isEntryPage: boolean
    ): Promise<CrawledPage | null> {
        let page: FetchedPage

        try {
            page = await this.fetcher.fetch(url)
        } catch (error) {
            if (!(error instanceof RemoteFetchException)) {
                throw error
            }

            logger.info(
                { domainId: domain.id, url, reason: error.message },
                'Crawler melewati halaman'
            )

            return null
        }

        // Bila halaman yang didaftarkan sendiri pindah ke domain lain, tidak ada yang bisa ditelusuri;
        // laporkan tujuannya supaya pemilik tahu alasannya, alih-alih sekadar "gagal".
        if (isEntryPage && page.isSuccessful() && !this.isSameSite(page.url, domain.host)) {
            throw new SiteRedirectedException(page.url)
        }

        // Halaman yang didaftarkan boleh dialihkan ke mana pun di host yang sama; halaman lain harus tetap dalam cakupan.
        const isAllowedLocation = isEntryPage || this.isInScope(page.url, domain)

        if (!page.isSuccessful() || !page.isHtml() || !isAllowedLocation) {
            return null
        }

        const extracted = this.extractor.extract(page.text(), page.url)

        await Page.updateOrCreate(
            { domainId: domain.id, url: page.url },
            {
                title:
                    extracted.title !== null ? sliceChars(extracted.title, MAX_TITLE_LENGTH) : null,
                description: extracted.description,
                content: extracted.text,
                httpStatus: page.status,
                crawledAt: DateTime.now(),
            }
        )

        return { url: page.url, links: extracted.links }
    }

    private async loadRobotsRules(siteUrl: string): Promise<RobotsRules> {
        let robotsPage: FetchedPage

        try {
            // robots.txt selalu berada di akar situs, walau link yang didaftarkan menunjuk ke sub-halaman.
            robotsPage = await this.fetcher.fetch(`${originOf(siteUrl)}/robots.txt`)
        } catch (error) {
            if (!(error instanceof RemoteFetchException)) {
                throw error
            }

            // Tanpa robots.txt yang terbaca, situs dianggap mengizinkan semua halaman (perilaku umum crawler).
            logger.info({ url: siteUrl, reason: error.message }, 'robots.txt tidak dapat dibaca')

            return RobotsRules.allowAll()
        }

        if (!robotsPage.isSuccessful()) {
            return RobotsRules.allowAll()
        }

        return RobotsRules.parse(robotsPage.text(), crawler.userAgent)
    }

    // "www.contoh.com" dan "contoh.com" dianggap situs yang sama karena umumnya saling mengalihkan.
    private isSameSite(url: string, host: string): boolean {
        return hostWithoutWww(url) === host.toLowerCase().replace(/^www\./, '')
    }

    private isInScope(url: string, domain: Domain): boolean {
        if (!this.isSameSite(url, domain.host)) {
            return false
        }

        const scopePath = (URL.parse(domain.url)?.pathname ?? '').replace(/\/+$/, '')
        const path = URL.parse(url)?.pathname ?? ''

        // "/latoto-kl1" mencakup "/latoto-kl1" dan "/latoto-kl1/...", tapi tidak "/latoto-kl10".
        return scopePath === '' || path === scopePath || path.startsWith(`${scopePath}/`)
    }
}
