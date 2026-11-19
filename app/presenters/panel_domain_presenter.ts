import type { DateTime } from 'luxon'
import type Domain from '#models/domain'
import type User from '#models/user'
import { canManageDomain, findPanelDomain } from '#services/domain_access'

function isoOf(value: DateTime | null): string | null {
    return value?.toISO({ suppressMilliseconds: true }) ?? null
}

/**
 * Tampilan domain di panel (padanan OwnedDomainResource), ditambah pemilik dan hak kelola supaya
 * superadmin yang melihat situs member tahu siapa pemiliknya. Relasi user dan tags serta jumlah
 * pages ($extras.pages_count) wajib sudah dimuat.
 */
export function presentPanelDomain(domain: Domain, canManage: boolean) {
    return {
        id: domain.id,
        url: domain.url,
        host: domain.host,
        title: domain.title,
        description: domain.description,
        logo_url: domain.logoUrl,
        is_promoted: domain.isPromoted,
        tags: domain.tags.map((tag) => tag.name),
        // true: diisi pemilik sendiri, tidak ditimpa saat data situs dibaca ulang.
        is_description_edited: domain.descriptionEditedAt !== null,
        is_tags_edited: domain.tagsEditedAt !== null,
        crawl_status: domain.crawlStatus,
        redirected_to: domain.redirectedTo,
        last_crawled_at: isoOf(domain.lastCrawledAt),
        pages_count: Number(domain.$extras.pages_count ?? 0),
        owner: { id: domain.user.id, name: domain.user.name, email: domain.user.email },
        can_manage: canManage,
        created_at: isoOf(domain.createdAt),
        updated_at: isoOf(domain.updatedAt),
    }
}

/**
 * Memuat ulang domain dari basis data (setelah diubah) lalu menampilkannya untuk pengguna ini.
 */
export async function presentPanelDomainById(id: number, viewer: User) {
    const domain = await findPanelDomain(id)

    return presentPanelDomain(domain, await canManageDomain(viewer, domain))
}
