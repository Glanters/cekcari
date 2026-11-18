import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { failure } from '#support/api_response'

type FrameworkError = { code?: string; status?: number; messages?: unknown }

/**
 * Semua kesalahan API dikembalikan dalam bentuk standar dengan pesan yang dipahami pengguna;
 * detail teknis hanya ditulis ke log.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
    protected debug = !app.inProduction

    async handle(error: unknown, ctx: HttpContext) {
        if (!ctx.request.url().startsWith('/api/')) {
            return super.handle(error, ctx)
        }

        const { code, status, messages } = (error ?? {}) as FrameworkError

        switch (code) {
            case 'E_VALIDATION_ERROR':
                return failure(ctx, 'Isian belum sesuai. Periksa kembali kolom yang ditandai.', this.groupValidationMessages(messages), 422)
            case 'E_UNAUTHORIZED_ACCESS':
                return failure(ctx, 'Silakan masuk terlebih dahulu.', {}, 401)
            case 'E_AUTHORIZATION_FAILURE':
                return failure(ctx, 'Anda tidak berhak mengakses data ini.', {}, 403)
            case 'E_ROW_NOT_FOUND':
            case 'E_ROUTE_NOT_FOUND':
                return failure(ctx, 'Data tidak ditemukan.', {}, 404)
            case 'E_TOO_MANY_REQUESTS':
                return failure(ctx, 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.', {}, 429)
            case 'E_BAD_CSRF_TOKEN':
                return failure(ctx, 'Sesi Anda sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.', {}, 419)
        }

        if (typeof status === 'number' && status >= 400 && status < 500) {
            return failure(ctx, 'Permintaan tidak dapat diproses.', {}, status)
        }

        ctx.logger.error({ err: error }, 'Unhandled API error')

        return failure(ctx, 'Terjadi kesalahan pada server. Silakan coba lagi nanti.', {}, 500)
    }

    async report(error: unknown, ctx: HttpContext) {
        return super.report(error, ctx)
    }

    private groupValidationMessages(messages: unknown): Record<string, string[]> {
        const grouped: Record<string, string[]> = {}

        for (const item of Array.isArray(messages) ? messages : []) {
            const { field, message } = item as { field: string; message: string }
            grouped[field] = [...(grouped[field] ?? []), message]
        }

        return grouped
    }
}
