import type { HttpContext } from '@adonisjs/core/http'

/**
 * Bentuk jawaban API standar perusahaan: { success, message, data | errors }.
 */
export function success(ctx: HttpContext, message: string, data: unknown = null, status = 200) {
    return ctx.response.status(status).json({ success: true, message, data: data ?? {} })
}

export function failure(ctx: HttpContext, message: string, errors: Record<string, string[]> = {}, status = 400) {
    return ctx.response.status(status).json({ success: false, message, errors })
}

export type Pagination = { page: number; per_page: number; total: number; last_page: number }

export function paginated(
    ctx: HttpContext,
    message: string,
    items: unknown[],
    pagination: Pagination,
    extra: Record<string, unknown> = {}
) {
    return success(ctx, message, { items, pagination, ...extra })
}

/**
 * page/per_page dari query string, dibatasi agar tidak bisa meminta data berlebihan.
 */
export function paginationOf(ctx: HttpContext, defaultPerPage = 10, maxPerPage = 50) {
    const page = Math.max(1, Number.parseInt(String(ctx.request.input('page', 1)), 10) || 1)
    const requested = Number.parseInt(String(ctx.request.input('per_page', defaultPerPage)), 10) || defaultPerPage

    return { page, perPage: Math.min(Math.max(1, requested), maxPerPage) }
}

/**
 * Mengubah paginator Lucid menjadi bentuk pagination standar.
 */
export function paginationMeta(paginator: { currentPage: number; perPage: number; total: number; lastPage: number }): Pagination {
    return {
        page: paginator.currentPage,
        per_page: paginator.perPage,
        total: paginator.total,
        last_page: paginator.lastPage,
    }
}
