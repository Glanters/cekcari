import vine from '@vinejs/vine'
import Domain from '#models/domain'
import User from '#models/user'
import { addressOf } from '#support/site_address'
import { localizedMessages } from '#validators/localized_messages'

export const DOMAIN_OWNER_SCOPES = ['all', 'mine'] as const

export type DomainOwnerScope = (typeof DOMAIN_OWNER_SCOPES)[number]

// ownerId: pemilik link setelah disimpan; domainId: domain yang sedang diubah (null saat menambah).
type LinkRuleMeta = { ownerId: number; domainId: number | null }

/**
 * Pemilik boleh menulis alamat polos seperti "psms.com"; skema https dipakai sebagai bawaan.
 */
export function prepareSiteUrl(input: unknown): string {
    const url = String(input ?? '').trim()

    return url !== '' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `https://${url}` : url
}

// Satu domain boleh punya beberapa link (path berbeda), tapi link yang sama hanya boleh terdaftar sekali.
const linkNotYetRegistered = vine.createRule(
    async (value, _options, field) => {
        const { ownerId, domainId } = field.meta as LinkRuleMeta
        // Sama dengan ekspresi indeks unik domains_address_unique: link tanpa skema.
        const existingDomain = await Domain.query()
            .withScopes((scopes) => scopes.active())
            .whereRaw("split_part(url, '://', 2) = ?", [addressOf(String(value))])
            .if(domainId !== null, (query) => query.whereNot('id', domainId as number))
            .first()

        if (existingDomain === null) {
            return
        }

        field.report(
            existingDomain.userId === ownerId
                ? 'Link ini sudah ada di daftar Anda.'
                : 'Link ini sudah didaftarkan oleh akun lain.',
            'linkNotYetRegistered',
            field
        )
    },
    { isAsync: true }
)

const activeOwner = vine.createRule(
    async (value, _options, field) => {
        const owner = await User.query()
            .where('id', Number(value))
            .whereNotNull('activated_at')
            .first()

        if (owner === null) {
            field.report('Pemilik tidak ditemukan atau belum aktif.', 'activeOwner', field)
        }
    },
    { isAsync: true }
)

const siteUrl = () =>
    vine
        .string()
        .maxLength(255)
        .url({ protocols: ['http', 'https'], require_protocol: true })
        .use(linkNotYetRegistered())

const DOMAIN_FIELD_NAMES = { url: 'link situs', user_id: 'pemilik' }

export const domainIndexValidator = vine.create({
    q: vine.string().trim().maxLength(100).optional(),
    owner: vine.enum(DOMAIN_OWNER_SCOPES).optional(),
    user_id: vine.number().withoutDecimals().min(1).optional(),
})

domainIndexValidator.messagesProvider = localizedMessages({
    q: 'kata pencarian',
    owner: 'cakupan pemilik',
    user_id: 'pemilik',
})

export const storeDomainValidator = vine.withMetaData<LinkRuleMeta>().create({
    // Hanya untuk pengguna dengan izin domains.manage_all; diperiksa di controller sebelum validasi.
    user_id: vine.number().withoutDecimals().min(1).use(activeOwner()).optional(),
    url: siteUrl(),
})

storeDomainValidator.messagesProvider = localizedMessages(DOMAIN_FIELD_NAMES)

export const updateDomainValidator = vine.withMetaData<LinkRuleMeta>().create({
    url: siteUrl(),
})

updateDomainValidator.messagesProvider = localizedMessages(DOMAIN_FIELD_NAMES)

export const domainPromotionValidator = vine.create({
    is_promoted: vine.boolean(),
})

domainPromotionValidator.messagesProvider = localizedMessages({ is_promoted: 'status promosi' })

export const domainOwnerIndexValidator = vine.create({
    q: vine.string().trim().maxLength(100).optional(),
})

domainOwnerIndexValidator.messagesProvider = localizedMessages({ q: 'kata pencarian' })
