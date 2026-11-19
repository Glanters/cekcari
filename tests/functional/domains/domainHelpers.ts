import db from '@adonisjs/lucid/services/db'
import Domain from '#models/domain'
import type User from '#models/user'
import { CRAWL_DOMAIN_JOB } from '#jobs/crawlDomainDispatch'
import { createUser } from '#tests/functional/auth/authHelpers'

let domainSequence = 0

/**
 * Padanan Domain::factory() di versi Laravel: tanpa pemilik, dibuatkan member baru.
 */
export async function createDomain(
    attributes: Partial<Domain> = {},
    owner?: User
): Promise<Domain> {
    domainSequence++
    const domainOwner = owner ?? (await createUser())
    const host = attributes.host ?? `situs${domainSequence}-${Date.now()}.test`

    return Domain.create({
        userId: domainOwner.id,
        url: `https://${host}`,
        host,
        title: `Situs ${domainSequence}`,
        description: 'Deskripsi situs.',
        crawlStatus: 'done',
        createdBy: domainOwner.id,
        updatedBy: domainOwner.id,
        ...attributes,
    })
}

export async function queuedCrawlDomainIds(): Promise<number[]> {
    const rows = await db
        .from('queue_jobs')
        .where('name', CRAWL_DOMAIN_JOB)
        .whereNull('failed_at')
        .orderBy('id')
        .select('payload')

    return rows.map((row) => Number(row.payload.domainId))
}
