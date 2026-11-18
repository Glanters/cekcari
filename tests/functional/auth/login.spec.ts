import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import { accountCenter } from '#config/cekcari'
import { unavailableResult } from '#services/account_center/account_center_result'
import { ROLES } from '#services/permissions'
import { generateTotp, generateTotpSecret } from '#services/totp'
import { setTwoFactorRequired } from '#services/two_factor_policy'
import {
    PanelBrowser,
    expectBody,
    expectStatus,
    createSuperadmin,
    createUser,
    fakeAccountCenter,
    resetLimiters,
    restoreAccountCenter,
} from '#tests/functional/auth/auth_helpers'

async function requireTwoFactor() {
    await setTwoFactorRequired(true, await createSuperadmin())
}

async function createUserWithTwoFactor(
    email: string,
    secret = generateTotpSecret(),
    recoveryCodes: string[] = []
) {
    const user = await createUser({ email })
    user.twoFactorSecret = secret
    user.twoFactorRecoveryCodes = await Promise.all(recoveryCodes.map((code) => hash.make(code)))
    user.twoFactorConfirmedAt = DateTime.now()
    await user.save()

    return user
}

test.group('Login: Account Center, aktivasi, dan 2FA', (group) => {
    const originalSuperadminEmails = accountCenter.superadminEmails

    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(async () => {
        fakeAccountCenter()
        await resetLimiters()

        return () => {
            restoreAccountCenter()
            accountCenter.superadminEmails = originalSuperadminEmails
        }
    })

    test('membuat akun menunggu aktivasi saat login pertama dan belum mengizinkan masuk', async ({
        client,
        assert,
    }) => {
        const browser = new PanelBrowser(client)

        const response = await browser.login('baru@contoh.id')

        response.assertStatus(403)
        response.assertBodyContains({
            success: false,
            message:
                'Akun Anda belum diaktifkan. Minta superadmin CekCari mengaktifkan akun ini, lalu masuk lagi.',
        })
        assert.isTrue(browser.isGuest)

        const user = await User.query()
            .where('email', 'baru@contoh.id')
            .preload('roles')
            .firstOrFail()
        assert.isFalse(user.isActive)
        assert.equal(user.role, ROLES.member)
        assert.equal(user.name, 'Baru')
    })

    test('menjadikan email superadmin awal langsung aktif sebagai superadmin', async ({
        client,
        assert,
    }) => {
        accountCenter.superadminEmails = 'lain@contoh.id, Bos@Contoh.id'
        const browser = new PanelBrowser(client)

        const response = await browser.login('bos@contoh.id')

        response.assertStatus(200)
        response.assertBodyContains({
            data: { status: 'authenticated', user: { role: 'superadmin' } },
        })
        assert.isFalse(browser.isGuest)
    })

    test('langsung masuk bila akun aktif dan 2FA sedang dimatikan', async ({ client, assert }) => {
        const user = await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        const response = await browser.login('RINA@contoh.id')

        response.assertStatus(200)
        response.assertBodyContains({
            data: { status: 'authenticated', user: { id: user.id, role: 'member' } },
        })
        assert.equal(browser.authenticatedUserId, user.id)

        await user.refresh()
        assert.isNotNull(user.lastLoginAt)
    })

    test('menolak kata sandi Account Center yang salah', async ({ client, assert }) => {
        await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        const response = await browser.login('rina@contoh.id', 'salah')

        response.assertStatus(422)
        assert.property(response.body().errors, 'email')
        assert.isTrue(browser.isGuest)
    })

    test('memberi tahu bila Account Center tidak dapat dihubungi', async ({ client }) => {
        fakeAccountCenter({ authenticate: async () => unavailableResult() })

        const response = await new PanelBrowser(client).login('rina@contoh.id')

        response.assertStatus(503)
        response.assertBodyContains({ success: false })
    })

    test('meminta pemasangan 2FA lalu masuk setelah kode pertama benar', async ({
        client,
        assert,
    }) => {
        await requireTwoFactor()
        const user = await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        const response = await browser.login('rina@contoh.id')
        response.assertStatus(200)
        response.assertBodyContains({ data: { status: 'two_factor_setup' } })

        const secret: string = response.body().data.two_factor_setup.secret
        assert.isTrue(
            response.body().data.two_factor_setup.qr_code.startsWith('data:image/svg+xml;base64,')
        )
        assert.isTrue(browser.isGuest)

        await expectStatus(browser.post('/api/v1/two-factor-setups', { code: '000000' }), 422)

        const confirmed = await browser.post('/api/v1/two-factor-setups', {
            code: generateTotp(secret),
        })
        confirmed.assertStatus(200)
        confirmed.assertBodyContains({
            data: { status: 'authenticated', user: { has_two_factor: true } },
        })
        assert.lengthOf(confirmed.body().data.recovery_codes, 8)
        assert.equal(browser.authenticatedUserId, user.id)

        // Kunci 2FA disimpan terenkripsi dan recovery code disimpan dalam bentuk hash.
        const stored = await db.from('users').where('id', user.id).firstOrFail()
        assert.notInclude(stored.two_factor_secret, secret)
        assert.notInclude(
            JSON.stringify(stored.two_factor_recovery_codes),
            confirmed.body().data.recovery_codes[0]
        )
    })

    test('meminta kode 2FA dan tidak menerima kode yang sama dua kali', async ({
        client,
        assert,
    }) => {
        await requireTwoFactor()
        const secret = generateTotpSecret()
        await createUserWithTwoFactor('rina@contoh.id', secret)
        const browser = new PanelBrowser(client)

        await expectBody(browser.login('rina@contoh.id'), {
            data: { status: 'two_factor_challenge' },
        })
        assert.isTrue(browser.isGuest)

        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '000000' }), 422)

        const code = generateTotp(secret)
        const accepted = await browser.post('/api/v1/two-factor-challenges', { code })
        accepted.assertStatus(200)
        accepted.assertBodyContains({ data: { status: 'authenticated' } })
        assert.isFalse(browser.isGuest)

        await expectStatus(browser.delete('/api/v1/sessions'), 200)

        await expectBody(browser.login('rina@contoh.id'), {
            data: { status: 'two_factor_challenge' },
        })
        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code }), 422)
    })

    test('hanya satu dari dua permintaan bersamaan yang bisa memakai kode yang sama', async ({
        client,
        assert,
    }) => {
        await requireTwoFactor()
        const secret = generateTotpSecret()
        await createUserWithTwoFactor('rina@contoh.id', secret)
        const first = new PanelBrowser(client)
        const second = new PanelBrowser(client)
        await first.login('rina@contoh.id')
        await second.login('rina@contoh.id')

        const code = generateTotp(secret)
        const responses = await Promise.all([
            first.post('/api/v1/two-factor-challenges', { code }),
            second.post('/api/v1/two-factor-challenges', { code }),
        ])

        assert.sameMembers(
            responses.map((response) => response.status()),
            [200, 422]
        )
    })

    test('menerima recovery code sekali saja', async ({ client }) => {
        await requireTwoFactor()
        await createUserWithTwoFactor('rina@contoh.id', generateTotpSecret(), ['abcde-12345'])
        const browser = new PanelBrowser(client)

        await browser.login('rina@contoh.id')
        await expectStatus(
            browser.post('/api/v1/two-factor-challenges', { code: 'ABCDE-12345' }),
            200
        )

        await expectStatus(browser.delete('/api/v1/sessions'), 200)

        await browser.login('rina@contoh.id')
        await expectStatus(
            browser.post('/api/v1/two-factor-challenges', { code: 'abcde-12345' }),
            422
        )
    })

    test('membatalkan login setelah lima kode salah', async ({ client }) => {
        await requireTwoFactor()
        await createUserWithTwoFactor('rina@contoh.id')
        const browser = new PanelBrowser(client)

        await browser.login('rina@contoh.id')

        for (let attempt = 1; attempt <= 4; attempt++) {
            await expectStatus(
                browser.post('/api/v1/two-factor-challenges', { code: '000000' }),
                422
            )
        }

        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '000000' }), 410)
        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '000000' }), 410)
    })

    test('menolak kode 2FA tanpa langkah login sebelumnya', async ({ client }) => {
        const browser = new PanelBrowser(client)

        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '123456' }), 410)
        await expectStatus(browser.post('/api/v1/two-factor-setups', { code: '123456' }), 410)
    })

    test('memutus sesi akun yang dinonaktifkan', async ({ client, assert }) => {
        const user = await createUser({ activatedAt: null })
        const browser = new PanelBrowser(client).actingAs(user)

        const response = await browser.get('/api/v1/profile')

        response.assertStatus(403)
        response.assertBodyContains({ success: false, errors: { reason: ['account_inactive'] } })
        assert.isTrue(browser.isGuest)
    })

    test('mengembalikan 401 untuk profil tanpa login', async ({ client }) => {
        const response = await new PanelBrowser(client).get('/api/v1/profile')

        response.assertStatus(401)
        response.assertBodyContains({ success: false })
    })

    test('menampilkan profil beserta peran', async ({ client }) => {
        const user = await createSuperadmin({ email: 'bos@contoh.id' })

        const response = await new PanelBrowser(client).actingAs(user).get('/api/v1/profile')

        response.assertStatus(200)
        response.assertBody({
            success: true,
            message: 'Data profil berhasil diambil',
            data: {
                id: user.id,
                name: user.name,
                email: 'bos@contoh.id',
                avatar_url: null,
                role: 'superadmin',
                has_two_factor: false,
            },
        })
    })

    test('keluar dari sesi', async ({ client, assert }) => {
        const browser = new PanelBrowser(client).actingAs(await createUser())

        await expectStatus(browser.delete('/api/v1/sessions'), 200)

        assert.isTrue(browser.isGuest)
    })

    test('mengunci 2FA akun setelah lima kode salah walaupun login diulang', async ({
        client,
        assert,
    }) => {
        await requireTwoFactor()
        await createUserWithTwoFactor('rina@contoh.id')
        const browser = new PanelBrowser(client)

        await browser.login('rina@contoh.id')
        for (let attempt = 1; attempt <= 3; attempt++) {
            await expectStatus(
                browser.post('/api/v1/two-factor-challenges', { code: '000000' }),
                422
            )
        }

        await expectBody(browser.login('rina@contoh.id'), {
            data: { status: 'two_factor_challenge' },
        })
        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '000000' }), 422)
        await expectStatus(browser.post('/api/v1/two-factor-challenges', { code: '000000' }), 422)

        const response = await browser.login('rina@contoh.id')
        response.assertStatus(429)
        response.assertBodyContains({ success: false })
        assert.isTrue(browser.isGuest)
    })

    test('tidak menimpa 2FA yang sudah terpasang lewat sesi pemasangan lama', async ({
        client,
        assert,
    }) => {
        await requireTwoFactor()
        const user = await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        const setup = await browser.login('rina@contoh.id')
        const secret: string = setup.body().data.two_factor_setup.secret

        // Di tab lain akun ini sudah selesai memasang 2FA dengan kunci berbeda.
        user.twoFactorSecret = 'JBSWY3DPEHPK3PXP'
        user.twoFactorConfirmedAt = DateTime.now()
        await user.save()

        await expectStatus(
            browser.post('/api/v1/two-factor-setups', { code: generateTotp(secret) }),
            410
        )

        await user.refresh()
        assert.equal(user.twoFactorSecret, 'JBSWY3DPEHPK3PXP')
    })

    test('memberi cookie XSRF-TOKEN sebelum login', async ({ client, assert }) => {
        const response = await new PanelBrowser(client).get('/api/v1/csrf-token')

        response.assertStatus(204)
        assert.exists(response.cookie('XSRF-TOKEN'))
    })
})
