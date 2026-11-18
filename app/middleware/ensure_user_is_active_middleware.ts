import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Sementara: diganti modul login.
export default class EnsureUserIsActiveMiddleware {
    async handle(_ctx: HttpContext, next: NextFn) {
        return next()
    }
}
