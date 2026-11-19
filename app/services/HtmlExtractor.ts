import { inject } from '@adonisjs/core'
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { crawler } from '#config/cekcari'
import UrlResolver from '#services/UrlResolver'
import { sliceChars } from '#support/characters'

// Ikon yang dinyatakan halaman: favicon biasa (rel="icon") dan logo besar untuk layar ponsel.
export type SiteIcons = { faviconUrl: string | null; touchIconUrl: string | null }

export type ExtractedHtml = {
    title: string | null
    description: string | null
    keywords: string[]
    icons: SiteIcons
    text: string
    links: string[]
}

const NON_CONTENT_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas']

type ValueReader = ($: CheerioAPI) => string | undefined

function cleanWhitespace(value: string): string {
    return value.replace(/\s+/gu, ' ').trim()
}

function metaContent(attribute: 'name' | 'property', expected: string): ValueReader {
    return ($) =>
        $('meta[content]')
            .filter((_, element) => ($(element).attr(attribute) ?? '').toLowerCase() === expected)
            .first()
            .attr('content')
}

function linkHref(matchesRel: (rel: string) => boolean): ValueReader {
    return ($) =>
        $('link[href]')
            .filter((_, element) => matchesRel(($(element).attr('rel') ?? '').toLowerCase()))
            .first()
            .attr('href')
}

@inject()
export default class HtmlExtractor {
    constructor(private readonly urlResolver: UrlResolver) {}

    extract(html: string, pageUrl: string): ExtractedHtml {
        const $ = cheerio.load(html)

        // Urutan penting: teks dibaca setelah title/meta, lalu tautan dibaca setelah elemen non-konten dibuang.
        const title = this.firstValue($, [
            (document) => document('title').first().text(),
            metaContent('property', 'og:title'),
        ])
        const description = this.firstValue($, [
            metaContent('name', 'description'),
            metaContent('property', 'og:description'),
        ])
        const keywords = this.keywords($)
        const icons = this.icons($, pageUrl)
        const text = this.visibleText($)
        const links = this.links($, pageUrl)

        return { title, description, keywords, icons, text, links }
    }

    // Nilai pertama yang tidak kosong; setiap pembaca hanya melihat elemen pertama yang cocok.
    private firstValue($: CheerioAPI, readers: ValueReader[]): string | null {
        for (const read of readers) {
            const value = cleanWhitespace(read($) ?? '')

            if (value !== '') {
                return value
            }
        }

        return null
    }

    private keywords($: CheerioAPI): string[] {
        const rawKeywords = this.firstValue($, [metaContent('name', 'keywords')])

        if (rawKeywords === null) {
            return []
        }

        const keywords = rawKeywords.split(',').map((keyword) => keyword.trim().toLowerCase())

        return [...new Set(keywords.filter((keyword) => keyword !== ''))]
    }

    private icons($: CheerioAPI, pageUrl: string): SiteIcons {
        const resolve = (href: string | null) =>
            href !== null ? this.urlResolver.resolve(pageUrl, href) : null

        return {
            faviconUrl: resolve(
                this.firstValue($, [linkHref((rel) => rel.split(/\s+/).includes('icon'))])
            ),
            touchIconUrl: resolve(
                this.firstValue($, [linkHref((rel) => rel.includes('apple-touch-icon'))])
            ),
        }
    }

    private visibleText($: CheerioAPI): string {
        $(NON_CONTENT_TAGS.join(',')).remove()

        return sliceChars(cleanWhitespace($('body').text()), crawler.maxContentChars)
    }

    private links($: CheerioAPI, pageUrl: string): string[] {
        const links = new Set<string>()

        $('a[href]').each((_, anchor) => {
            if (($(anchor).attr('rel') ?? '').toLowerCase().includes('nofollow')) {
                return
            }

            const absoluteUrl = this.urlResolver.resolve(pageUrl, $(anchor).attr('href') ?? '')

            if (absoluteUrl !== null) {
                links.add(absoluteUrl)
            }
        })

        return [...links]
    }
}
