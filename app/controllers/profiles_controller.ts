import type { HttpContext } from '@adonisjs/core/http'
import { presentUser } from '#presenters/user_presenter'
import { success } from '#support/api_response'

export default class ProfilesController {
    async show(ctx: HttpContext) {
        const user = ctx.auth.getUserOrFail()
        await user.load('roles')

        return success(ctx, 'Data profil berhasil diambil', presentUser(user))
    }
}
