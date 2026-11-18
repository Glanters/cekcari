import AppSetting from '#models/app_setting'
import type User from '#models/user'

/**
 * Wajib atau tidaknya 2FA saat login, diatur superadmin dari dasbor (mis. dimatikan selama masa uji).
 * Saat dimatikan, kunci 2FA yang sudah dipasang pengguna tetap tersimpan, jadi begitu dinyalakan
 * lagi mereka langsung memakai aplikasi authenticator yang sama.
 */
export const TWO_FACTOR_SETTING_KEY = 'auth.two_factor_required'

export async function isTwoFactorRequired(): Promise<boolean> {
    // Tanpa pengaturan tersimpan, 2FA dianggap wajib: lebih aman gagal tertutup.
    return Boolean(await AppSetting.valueOf(TWO_FACTOR_SETTING_KEY, true))
}

export async function setTwoFactorRequired(isRequired: boolean, changedBy: User): Promise<void> {
    await AppSetting.store(TWO_FACTOR_SETTING_KEY, isRequired, changedBy.id)
}
