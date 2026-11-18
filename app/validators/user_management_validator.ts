import vine from '@vinejs/vine'
import { USER_ROLES } from '#services/permissions'
import { localizedMessages } from '#validators/localized_messages'

export const USER_STATUS_PENDING = 'pending'

export const USER_STATUS_ACTIVE = 'active'

export const userIndexValidator = vine.create({
    q: vine.string().trim().maxLength(100).optional(),
    status: vine.enum([USER_STATUS_PENDING, USER_STATUS_ACTIVE]).optional(),
})

userIndexValidator.messagesProvider = localizedMessages({ q: 'kata pencarian', status: 'status' })

export const updateUserActivationValidator = vine.create({
    is_active: vine.boolean(),
})

updateUserActivationValidator.messagesProvider = localizedMessages({ is_active: 'status aktivasi' })

export const updateUserRoleValidator = vine.create({
    role: vine.enum(USER_ROLES),
})

updateUserRoleValidator.messagesProvider = localizedMessages({ role: 'peran' })
