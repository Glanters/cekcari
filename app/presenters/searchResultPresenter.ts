import type { SearchHit } from '#services/SearchService'

/**
 * Bentuk satu kartu hasil pencarian untuk frontend (lihat resources/js/components/ResultCard.vue).
 */
export function presentSearchHit(hit: SearchHit) {
    const { domain } = hit

    return {
        id: Number(domain.id),
        url: domain.url,
        host: domain.host,
        title: hit.titleHighlight,
        description: hit.descriptionHighlight,
        logo_url: domain.logoUrl,
        related_pages: hit.relatedPages,
    }
}
