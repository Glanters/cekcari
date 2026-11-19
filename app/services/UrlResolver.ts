/**
 * Mengubah tautan relatif di halaman menjadi URL absolut yang seragam,
 * supaya halaman yang sama tidak tersimpan dua kali dengan penulisan berbeda.
 */
export default class UrlResolver {
    resolve(baseUrl: string, href: string): string | null {
        const trimmedHref = href.trim()

        if (
            trimmedHref === '' ||
            trimmedHref.startsWith('#') ||
            /^(mailto|tel|javascript|data):/i.test(trimmedHref)
        ) {
            return null
        }

        const base = URL.parse(baseUrl)

        if (base === null || base.hostname === '') {
            return null
        }

        const absolute = URL.parse(trimmedHref, base)

        return absolute === null ? null : this.normalize(absolute.href)
    }

    /**
     * Skema dan host huruf kecil, port bawaan dibuang, segmen "." dan ".." diselesaikan,
     * fragmen dibuang. Kredensial di URL tidak pernah ikut ke hasil.
     */
    normalize(url: string): string | null {
        const parsed = URL.parse(url)

        if (
            parsed === null ||
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.hostname === ''
        ) {
            return null
        }

        return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`
    }
}
