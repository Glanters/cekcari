import vine from '@vinejs/vine'
import { normalizeEntry } from '#services/ipWhitelist'
import { localizedMessages } from '#validators/localizedMessages'

export const updateSecuritySettingValidator = vine.create({
    is_two_factor_required: vine.boolean().optional().requiredIfMissing('is_ip_whitelist_enabled'),
    is_ip_whitelist_enabled: vine.boolean().optional().requiredIfMissing('is_two_factor_required'),
})

updateSecuritySettingValidator.messagesProvider = localizedMessages({
    is_two_factor_required: 'kewajiban 2FA',
    is_ip_whitelist_enabled: 'whitelist IP',
})

// Disimpan dalam bentuk baku agar "10.0.0.5" dan " 10.0.0.5 " dianggap entri yang sama.
const ipEntryRule = vine.createRule((value, _options, field) => {
    const normalized = normalizeEntry(String(value))

    if (normalized === null) {
        field.report(
            'Isi alamat IP (mis. 103.10.20.30) atau rentang CIDR (mis. 103.10.20.0/24) yang valid.',
            'ipEntry',
            field
        )

        return
    }

    field.mutate(normalized, field)
})

export const storeIpWhitelistEntryValidator = vine.create({
    value: vine
        .string()
        .trim()
        .use(ipEntryRule())
        .maxLength(64)
        .unique({ table: 'ip_whitelist_entries', column: 'value' }),
    label: vine.string().trim().maxLength(100).nullable().optional(),
})

storeIpWhitelistEntryValidator.messagesProvider = localizedMessages(
    { value: 'alamat IP', label: 'keterangan' },
    { 'value.database.unique': 'Alamat ini sudah ada di whitelist.' }
)
