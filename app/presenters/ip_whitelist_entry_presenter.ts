import type IpWhitelistEntry from '#models/ip_whitelist_entry'

export function presentIpWhitelistEntry(entry: IpWhitelistEntry) {
    return {
        id: Number(entry.id),
        value: entry.value,
        label: entry.label,
        created_at: entry.createdAt?.toISO() ?? null,
    }
}
