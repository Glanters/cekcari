import app from '@adonisjs/core/services/app'
import { accountCenter } from '#config/cekcari'
import type {
    AccountCenterClient,
    AccountCenterResult,
} from '#services/account_center/account_center_result'
import { DummyAccountCenterClient } from '#services/account_center/dummy_account_center_client'
import { HttpAccountCenterClient } from '#services/account_center/http_account_center_client'

type AccountCenterConfig = typeof accountCenter

/**
 * Dummy hanya untuk masa uji. Di production login selalu lewat Account Center sungguhan,
 * walaupun ACCOUNTCENTER_DRIVER=dummy terlanjur terisi.
 */
export function selectAccountCenterClient(
    config: AccountCenterConfig,
    isProduction: boolean
): AccountCenterClient {
    if (config.driver === 'dummy' && !isProduction) {
        return new DummyAccountCenterClient(config.dummyPassword?.release() ?? '')
    }

    return new HttpAccountCenterClient({
        uri: config.uri,
        name: config.name,
        secret: config.secret?.release() ?? '',
        timeoutMs: config.timeoutMs,
    })
}

/**
 * Titik masuk yang dipakai controller lewat container, supaya test bisa menggantinya
 * (app.container.swap) dengan klien tiruan.
 */
export default class AccountCenter {
    constructor(
        private readonly client: AccountCenterClient = selectAccountCenterClient(
            accountCenter,
            app.inProduction
        )
    ) {}

    authenticate(email: string, password: string): Promise<AccountCenterResult> {
        return this.client.authenticate(email, password)
    }
}
