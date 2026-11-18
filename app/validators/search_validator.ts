import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import type { ValidationFields } from '@vinejs/vine/types'

export const DEFAULT_PER_PAGE = 10
export const MAX_PER_PAGE = 50
export const MIN_SUGGESTION_KEYWORD_LENGTH = 2

// Seed disimpan sebagai integer 32-bit di sisi pengunjung.
const MAX_SEED = 2147483647

export const searchResultsValidator = vine.create({
    // Kata kunci yang hanya berisi spasi dianggap kosong, sama seperti isian form yang dirapikan.
    q: vine.string().trim().minLength(1).maxLength(200),
    // Angka acak milik pengunjung; urutan hasil tetap sama selama seed-nya sama.
    seed: vine.number().withoutDecimals().min(1).max(MAX_SEED).optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
    per_page: vine.number().withoutDecimals().min(1).max(MAX_PER_PAGE).optional(),
})

export const searchSuggestionsValidator = vine.create({
    q: vine.string().trim().maxLength(100).optional(),
})

/**
 * Pesan global (start/validator.ts) dengan nama kolom yang dipahami pengunjung. Dibuat saat dipakai
 * karena pesan global baru terpasang setelah preload selesai.
 */
export function searchMessages() {
    return withFieldNames({ q: 'kata kunci', seed: 'seed urutan', per_page: 'jumlah per halaman', page: 'halaman' }, {
        'q.minLength': '{{ field }} wajib diisi.',
    })
}

function withFieldNames(fields: ValidationFields, overrides: Record<string, string> = {}) {
    const globalMessages = vine.messagesProvider instanceof SimpleMessagesProvider ? vine.messagesProvider.toJSON().messages : {}

    return new SimpleMessagesProvider({ ...globalMessages, ...overrides }, fields)
}
