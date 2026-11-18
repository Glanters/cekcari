import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'

export const plugins: Config['plugins'] = [
    assert(),
    apiClient(),
    pluginAdonisJS(app),
    sessionApiClient(app),
    shieldApiClient(),
    authApiClient(app),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
    setup: [() => testUtils.db().migrate()],
    teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
    if (suite.name === 'functional') {
        return suite.setup(() => testUtils.httpServer().start())
    }
}
