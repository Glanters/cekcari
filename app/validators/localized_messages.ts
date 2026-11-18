import vine from '@vinejs/vine'
import type { FieldContext, MessagesProviderContact } from '@vinejs/vine/types'

/**
 * Pesan global dari start/validator.ts dengan nama kolom berbahasa Indonesia untuk satu validator,
 * ditambah pesan khusus per kolom/aturan (mis. "value.database.unique") bila perlu.
 */
export function localizedMessages(
    fieldNames: Record<string, string>,
    customMessages: Record<string, string> = {}
): MessagesProviderContact {
    return {
        getMessage(
            rawMessage: string,
            rule: string,
            field: FieldContext,
            args?: Record<string, any>
        ) {
            const customMessage = customMessages[`${field.getFieldPath()}.${rule}`]

            if (customMessage) {
                return customMessage
            }

            const namedField = Object.assign(Object.create(field), {
                name: fieldNames[field.name] ?? field.name,
            })

            return vine.messagesProvider.getMessage(rawMessage, rule, namedField, args)
        },
    }
}
