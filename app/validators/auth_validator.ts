import vine from '@vinejs/vine'
import { localizedMessages } from '#validators/localized_messages'

export const storeSessionValidator = vine.create({
    email: vine.string().trim().email().maxLength(255),
    // Tidak di-trim: spasi bisa menjadi bagian sah kata sandi Account Center.
    password: vine.string().maxLength(255),
})

storeSessionValidator.messagesProvider = localizedMessages({ password: 'kata sandi' })

export const storeTwoFactorChallengeValidator = vine.create({
    // Kode 6 digit dari authenticator, atau recovery code bila ponsel hilang.
    code: vine.string().trim().maxLength(40),
})

storeTwoFactorChallengeValidator.messagesProvider = localizedMessages({ code: 'kode' })

export const storeTwoFactorSetupValidator = vine.create({
    code: vine
        .string()
        .trim()
        .regex(/^\d{6}$/),
})

storeTwoFactorSetupValidator.messagesProvider = localizedMessages(
    { code: 'kode' },
    { 'code.regex': 'kode harus 6 digit angka.' }
)
