import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'
import { middleware } from '#start/kernel'

const UsersController = () => import('#controllers/UsersController')
const UserActivationsController = () => import('#controllers/UserActivationsController')
const UserRolesController = () => import('#controllers/UserRolesController')
const UserTwoFactorsController = () => import('#controllers/UserTwoFactorsController')
const SecuritySettingsController = () => import('#controllers/SecuritySettingsController')
const IpWhitelistEntriesController = () => import('#controllers/IpWhitelistEntriesController')

/**
 * Khusus superadmin; izin (manage-users / manage-security) diperiksa di setiap controller.
 */
router
    .group(() => {
        router.get('users', [UsersController, 'index'])
        router
            .put('users/:id/activation', [UserActivationsController, 'update'])
            .where('id', router.matchers.number())
        router
            .put('users/:id/role', [UserRolesController, 'update'])
            .where('id', router.matchers.number())
        router
            .delete('users/:id/two-factor', [UserTwoFactorsController, 'destroy'])
            .where('id', router.matchers.number())
        router.get('security-settings', [SecuritySettingsController, 'show'])
        router.put('security-settings', [SecuritySettingsController, 'update'])
        router.get('ip-whitelist-entries', [IpWhitelistEntriesController, 'index'])
        router.post('ip-whitelist-entries', [IpWhitelistEntriesController, 'store'])
        router
            .delete('ip-whitelist-entries/:id', [IpWhitelistEntriesController, 'destroy'])
            .where('id', router.matchers.number())
    })
    .prefix('/api/v1')
    .domain(domains.panel)
    .use([middleware.auth(), middleware.active(), middleware.ipWhitelist()])
