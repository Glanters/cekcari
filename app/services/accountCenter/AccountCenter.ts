import app from '@adonisjs/core/services/app'
import { accountCenter } from '#config/cekcari'
import type {
    AccountCenterClient,
    AccountCenterResult,
} from '#services/accountCenter/accountCenterResult'
import { DummyAccountCenterClient } from '#services/accountCenter/DummyAccountCenterClient'
import { HttpAccountCenterClient } from '#services/accountCenter/HttpAccountCenterClient'

type AccountCenterConfig = typeof accountCenter

// Server uji yang terbuka di internet butuh kata sandi dummy yang sulit ditebak.
export const MIN_PRODUCTION_DUMMY_PASSWORD_LENGTH = 16

/**
 * Dummy untuk masa uji. Di mode production dummy hanya dipakai bila dinyalakan eksplisit
 * (ACCOUNTCENTER_DUMMY_IN_PRODUCTION=true, untuk server uji) dan kata sandinya cukup panjang;
 * selain itu login selalu lewat Account Center sungguhan walaupun ACCOUNTCENTER_DRIVER=dummy terisi.
 */
export function selectAccountCenterClient(
    config: AccountCenterConfig,
    isProduction: boolean
): AccountCenterClient {
    const dummyPassword = config.dummyPassword?.release() ?? ''
    const isDummyAllowed =
        !isProduction ||
        (config.isDummyAllowedInProduction &&
            dummyPassword.length >= MIN_PRODUCTION_DUMMY_PASSWORD_LENGTH)

    if (config.driver === 'dummy' && isDummyAllowed) {
        return new DummyAccountCenterClient(dummyPassword)
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
