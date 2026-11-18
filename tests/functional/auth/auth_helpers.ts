import { DateTime } from 'luxon'
import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'
import type { SessionData } from '@adonisjs/session/types'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import AccountCenter from '#services/account_center/account_center'
import { DummyAccountCenterClient } from '#services/account_center/dummy_account_center_client'
import type { AccountCenterClient } from '#services/account_center/account_center_result'
import { assignRole, ROLES, type UserRole } from '#services/permissions'
import { panel } from '#tests/helpers'

export const ACCOUNT_CENTER_PASSWORD = 'rahasia'

let emailSequence = 0

/**
 * Account Center tiruan: email apa pun diterima dengan kata sandi "rahasia". Dikembalikan
 * ke klien asli lewat restoreAccountCenter() di teardown grup.
 */
export function fakeAccountCenter(
    client: AccountCenterClient = new DummyAccountCenterClient(ACCOUNT_CENTER_PASSWORD)
) {
    app.container.swap(AccountCenter, () => new AccountCenter(client))
}

export function restoreAccountCenter() {
    app.container.restore(AccountCenter)
}

// Limiter memakai store memory yang hidup sepanjang proses test; dibersihkan agar batas
// 10 permintaan login per menit dan kunci 2FA per akun tidak terbawa ke test lain.
export async function resetLimiters() {
    await limiter.clear(['memory'])
}

export async function createUser(
    attributes: Partial<User> = {},
    role: UserRole = ROLES.member
): Promise<User> {
    emailSequence++

    const user = await User.create({
        name: `Pengguna ${emailSequence}`,
        email: `pengguna${emailSequence}.${Date.now()}@contoh.id`,
        activatedAt: DateTime.now(),
        ...attributes,
    })

    await db.transaction((trx) => assignRole(user, role, trx))

    return user
}

export function createSuperadmin(attributes: Partial<User> = {}): Promise<User> {
    return createUser(attributes, ROLES.superadmin)
}

export async function expectStatus(pending: Promise<ApiResponse>, status: number) {
    const response = await pending
    response.assertStatus(status)

    return response
}

export async function expectBody(pending: Promise<ApiResponse>, expected: unknown) {
    const response = await pending
    response.assertBodyContains(expected)

    return response
}

type Method = 'get' | 'post' | 'put' | 'delete'

/**
 * Meniru browser di domain panel: data sesi dari jawaban sebelumnya dikirim lagi di permintaan
 * berikutnya (plugin sesi Japa membuang sesi setelah setiap permintaan), token CSRF selalu
 * disertakan, dan IP klien bisa diatur lewat X-Forwarded-For (jalankan test dengan
 * TRUSTED_PROXIES=127.0.0.1,::1 supaya header itu dipercaya).
 */
export class PanelBrowser {
    private sessionValues: SessionData = {}
    private pendingLogin: User | null = null

    constructor(private readonly client: ApiClient) {}

    actingAs(user: User): this {
        this.pendingLogin = user
        this.sessionValues = {}

        return this
    }

    get(path: string, ip?: string) {
        return this.send('get', path, undefined, ip)
    }

    post(path: string, body: Record<string, unknown> = {}, ip?: string) {
        return this.send('post', path, body, ip)
    }

    put(path: string, body: Record<string, unknown> = {}, ip?: string) {
        return this.send('put', path, body, ip)
    }

    delete(path: string, ip?: string) {
        return this.send('delete', path, undefined, ip)
    }

    login(email: string, password = ACCOUNT_CENTER_PASSWORD, ip?: string) {
        return this.post('/api/v1/sessions', { email, password }, ip)
    }

    // auth_web adalah key sesi milik guard "web".
    get authenticatedUserId(): unknown {
        return this.sessionValues.auth_web
    }

    get isGuest(): boolean {
        return this.authenticatedUserId === undefined
    }

    private async send(
        method: Method,
        path: string,
        body: Record<string, unknown> | undefined,
        ip?: string
    ): Promise<ApiResponse> {
        let request: ApiRequest = panel(this.client)
            [method](path)
            .withSession(this.sessionValues)
            .withCsrfToken()

        if (this.pendingLogin !== null) {
            request = request.loginAs(this.pendingLogin)
            this.pendingLogin = null
        }

        if (body !== undefined) {
            request = request.json(body)
        }

        if (ip !== undefined) {
            request = request.header('X-Forwarded-For', ip)
        }

        const response = await request
        this.sessionValues = { ...response.session() }

        return response
    }
}
