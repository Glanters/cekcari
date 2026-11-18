import type { SearchHit } from '#services/search_service'

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
        tags: domain.tags.map((tag) => tag.name),
        related_pages: hit.relatedPages,
    }
}
