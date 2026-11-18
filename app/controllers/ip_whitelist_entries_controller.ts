import type { HttpContext } from '@adonisjs/core/http'
import IpWhitelistEntry from '#models/ip_whitelist_entry'
import { MAX_ENTRIES, isIpWhitelistEnabled } from '#services/ip_whitelist'
import { PERMISSIONS, authorize } from '#services/permissions'
import { presentIpWhitelistEntry } from '#presenters/ip_whitelist_entry_presenter'
import { failure, paginated, paginationMeta, paginationOf, success } from '#support/api_response'
import { storeIpWhitelistEntryValidator } from '#validators/security_validator'

async function countEntries(): Promise<number> {
    const result = await IpWhitelistEntry.query().count('* as total').firstOrFail()

    return Number(result.$extras.total)
}

export default class IpWhitelistEntriesController {
    async index(ctx: HttpContext) {
        await authorize(ctx.auth.getUserOrFail(), PERMISSIONS.manageSecurity)

        const { page, perPage } = paginationOf(ctx)
        const paginator = await IpWhitelistEntry.query()
            .orderBy('created_at', 'asc')
            .orderBy('id', 'asc')
            .paginate(page, perPage)

        return paginated(
            ctx,
            'Whitelist IP berhasil diambil',
            paginator.all().map(presentIpWhitelistEntry),
            paginationMeta(paginator)
        )
    }

    async store(ctx: HttpContext) {
        const admin = ctx.auth.getUserOrFail()
        await authorize(admin, PERMISSIONS.manageSecurity)

        const { value, label } = await ctx.request.validateUsing(storeIpWhitelistEntryValidator)

        if ((await countEntries()) >= MAX_ENTRIES) {
            const message = `Whitelist sudah berisi ${MAX_ENTRIES} alamat. Gabungkan beberapa alamat menjadi rentang CIDR.`

            return failure(ctx, message, { value: [message] }, 422)
        }

        const entry = await IpWhitelistEntry.create({
            value,
            label: label || null,
            createdBy: admin.id,
            updatedBy: admin.id,
        })

        return success(
            ctx,
            `${entry.value} ditambahkan ke whitelist`,
            presentIpWhitelistEntry(entry),
            201
        )
    }

    async destroy(ctx: HttpContext) {
        await authorize(ctx.auth.getUserOrFail(), PERMISSIONS.manageSecurity)

        const entry = await IpWhitelistEntry.findOrFail(ctx.params.id)

        // Whitelist aktif yang kosong akan diam-diam terbuka untuk semua orang; minta dimatikan dulu secara sadar.
        if ((await isIpWhitelistEnabled()) && (await countEntries()) === 1) {
            return failure(
                ctx,
                'Ini alamat terakhir di whitelist. Matikan whitelist IP dulu sebelum menghapusnya.',
                {},
                422
            )
        }

        await entry.delete()

        return success(ctx, `${entry.value} dihapus dari whitelist`)
    }
}
