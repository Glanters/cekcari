import type { HttpContext } from '@adonisjs/core/http'
import IpWhitelistEntry from '#models/ip_whitelist_entry'
import {
    isIpWhitelistEnabled,
    setIpWhitelistEnabled,
    whitelistContains,
} from '#services/ip_whitelist'
import { PERMISSIONS, authorize } from '#services/permissions'
import { isTwoFactorRequired, setTwoFactorRequired } from '#services/two_factor_policy'
import { failure, success } from '#support/api_response'
import { updateSecuritySettingValidator } from '#validators/security_validator'

// IP pemanggil ikut dikirim supaya superadmin tahu alamat jaringan yang sedang ia pakai.
async function presentSettings(ctx: HttpContext) {
    const ip = ctx.request.ip()

    return {
        is_two_factor_required: await isTwoFactorRequired(),
        is_ip_whitelist_enabled: await isIpWhitelistEnabled(),
        current_ip: ip,
        is_current_ip_whitelisted: await whitelistContains(ip),
    }
}

export default class SecuritySettingsController {
    async show(ctx: HttpContext) {
        await authorize(ctx.auth.getUserOrFail(), PERMISSIONS.manageSecurity)

        return success(ctx, 'Pengaturan keamanan berhasil diambil', await presentSettings(ctx))
    }

    async update(ctx: HttpContext) {
        const admin = ctx.auth.getUserOrFail()
        await authorize(admin, PERMISSIONS.manageSecurity)

        const settings = await ctx.request.validateUsing(updateSecuritySettingValidator)

        if (settings.is_ip_whitelist_enabled !== undefined) {
            const isEnabling = settings.is_ip_whitelist_enabled

            if (isEnabling && (await IpWhitelistEntry.query().first()) === null) {
                const message = 'Tambahkan minimal satu alamat IP sebelum menyalakan whitelist.'

                return failure(ctx, message, { is_ip_whitelist_enabled: [message] }, 422)
            }

            await setIpWhitelistEnabled(isEnabling, admin)

            return success(
                ctx,
                isEnabling
                    ? 'Whitelist IP aktif: member hanya bisa masuk dari alamat terdaftar'
                    : 'Whitelist IP dimatikan',
                await presentSettings(ctx)
            )
        }

        const isRequired = settings.is_two_factor_required === true
        await setTwoFactorRequired(isRequired, admin)

        return success(
            ctx,
            isRequired
                ? '2FA sekarang wajib saat masuk'
                : '2FA dimatikan: masuk cukup dengan akun Account Center',
            await presentSettings(ctx)
        )
    }
}
