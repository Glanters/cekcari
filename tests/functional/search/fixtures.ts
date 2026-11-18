import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Domain from '#models/domain'
import Page from '#models/page'
import Tag from '#models/tag'

let sequence = 0

type DomainAttributes = Partial<Pick<Domain, 'url' | 'host' | 'title' | 'description' | 'isPromoted'>>

type PageAttributes = Pick<Page, 'url' | 'title' | 'content'>

/**
 * Data uji pencarian: setiap domain butuh pemilik, dan link-nya harus unik selama belum dihapus.
 */
export async function createDomain(attributes: DomainAttributes = {}) {
    sequence += 1
    const host = attributes.host ?? `situs-uji-${sequence}.test`
    const now = DateTime.now().toSQL()

    const [owner] = await db
        .table('users')
        .insert({ name: `Pemilik ${sequence}`, email: `pemilik-${sequence}@contoh.test`, activated_at: now, created_at: now, updated_at: now })
        .returning('id')

    return Domain.create({
        userId: owner.id,
        url: `https://${host}`,
        host,
        title: `Situs ${sequence}`,
        description: 'Deskripsi umum untuk keperluan uji.',
        crawlStatus: 'done',
        isPromoted: false,
        ...attributes,
    })
}

export async function createDomains(count: number, attributes: DomainAttributes = {}) {
    const created: Domain[] = []

    for (let index = 0; index < count; index++) {
        created.push(await createDomain(attributes))
    }

    return created
}

export async function softDelete(domain: Domain) {
    domain.deletedAt = DateTime.now()
    await domain.save()
}

export async function createPage(domain: Domain, attributes: PageAttributes) {
    return Page.create({ domainId: domain.id, httpStatus: 200, crawledAt: DateTime.now(), ...attributes })
}

export async function attachTag(domain: Domain, name: string) {
    const tag = await Tag.create({ name, slug: name })
    await domain.related('tags').attach([tag.id])

    return tag
}
