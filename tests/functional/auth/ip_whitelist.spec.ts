import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import IpWhitelistEntry from '#models/ip_whitelist_entry'
import { accountCenter, domains } from '#config/cekcari'
import { allowsIp, setIpWhitelistEnabled } from '#services/ip_whitelist'
import { generateTotpSecret } from '#services/totp'
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

/**
 * IP klien disimulasikan lewat X-Forwarded-For; jalankan dengan TRUSTED_PROXIES=127.0.0.1,::1
 * agar header itu dipercaya dari klien test (lihat config/app.ts).
 */
async function whitelist(values: string[], isEnabled = true) {
    const admin = await createSuperadmin()

    for (const value of values) {
        await IpWhitelistEntry.create({ value, createdBy: admin.id, updatedBy: admin.id })
    }

    await setIpWhitelistEnabled(isEnabled, admin)
}

test.group('Whitelist IP', (group) => {
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

    test('membaca status dan daftar dari database', async ({ assert }) => {
        await whitelist(['103.10.20.30', '10.8.0.0/16', '2001:db8::/32'])

        assert.isTrue(await allowsIp('10.8.255.1'))
        assert.isFalse(await allowsIp('10.9.0.1'))
    })

    test('tidak membatasi siapa pun selama whitelist mati', async ({ client }) => {
        await whitelist(['103.10.20.30'], false)
        await createUser({ email: 'rina@contoh.id' })

        await expectStatus(
            new PanelBrowser(client).login('rina@contoh.id', undefined, '8.8.8.8'),
            200
        )
    })

    test('menolak login member dari IP di luar whitelist', async ({ client, assert }) => {
        await whitelist(['103.10.20.0/24'])
        await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        const rejected = await browser.login('rina@contoh.id', undefined, '8.8.8.8')
        rejected.assertStatus(403)
        rejected.assertBodyContains({ errors: { reason: ['ip_not_allowed'] } })
        assert.isTrue(browser.isGuest)

        await expectStatus(browser.login('rina@contoh.id', undefined, '103.10.20.7'), 200)
    })

    test('memutus sesi member yang pindah ke jaringan lain', async ({ client, assert }) => {
        await whitelist(['103.10.20.0/24'])
        const browser = new PanelBrowser(client).actingAs(await createUser())

        await expectStatus(browser.get('/api/v1/profile', '103.10.20.7'), 200)

        const response = await browser.get('/api/v1/profile', '8.8.8.8')
        response.assertStatus(403)
        response.assertBodyContains({ errors: { reason: ['ip_not_allowed'] } })
        assert.isTrue(browser.isGuest)
    })

    test('tidak pernah mengunci superadmin', async ({ client }) => {
        await whitelist(['103.10.20.0/24'])
        accountCenter.superadminEmails = 'bos@contoh.id'
        const browser = new PanelBrowser(client)

        await expectStatus(browser.login('bos@contoh.id', undefined, '8.8.8.8'), 200)
        await expectStatus(browser.get('/api/v1/profile', '8.8.8.8'), 200)
    })

    test('tidak memengaruhi domain pencarian', async ({ client }) => {
        await whitelist(['103.10.20.0/24'])

        const response = await client
            .get('/up')
            .header('Host', domains.search)
            .header('X-Forwarded-For', '8.8.8.8')

        response.assertStatus(200)
    })

    test('superadmin mengelola daftar dan tidak bisa menyalakan whitelist kosong', async ({
        client,
        assert,
    }) => {
        const browser = new PanelBrowser(client).actingAs(await createSuperadmin())

        await expectStatus(
            browser.put('/api/v1/security-settings', { is_ip_whitelist_enabled: true }),
            422
        )

        const created = await browser.post('/api/v1/ip-whitelist-entries', {
            value: ' 103.10.20.0/24 ',
            label: 'Kantor Surabaya',
        })
        created.assertStatus(201)
        created.assertBodyContains({ data: { value: '103.10.20.0/24', label: 'Kantor Surabaya' } })

        const duplicate = await browser.post('/api/v1/ip-whitelist-entries', {
            value: '103.10.20.0/24',
        })
        duplicate.assertStatus(422)
        assert.equal(duplicate.body().errors.value[0], 'Alamat ini sudah ada di whitelist.')
        await expectStatus(browser.post('/api/v1/ip-whitelist-entries', { value: 'bukan-ip' }), 422)

        const enabled = await browser.put(
            '/api/v1/security-settings',
            { is_ip_whitelist_enabled: true },
            '103.10.20.9'
        )
        enabled.assertStatus(200)
        enabled.assertBodyContains({
            data: {
                is_ip_whitelist_enabled: true,
                current_ip: '103.10.20.9',
                is_current_ip_whitelisted: true,
            },
        })

        const listed = await browser.get('/api/v1/ip-whitelist-entries')
        listed.assertStatus(200)
        assert.lengthOf(listed.body().data.items, 1)

        // Alamat terakhir tidak boleh dihapus selama whitelist aktif.
        const entryId = created.body().data.id
        await expectStatus(browser.delete(`/api/v1/ip-whitelist-entries/${entryId}`), 422)

        await expectStatus(
            browser.put('/api/v1/security-settings', { is_ip_whitelist_enabled: false }),
            200
        )
        await expectStatus(browser.delete(`/api/v1/ip-whitelist-entries/${entryId}`), 200)

        assert.isNull(await IpWhitelistEntry.query().first())
    })

    test('menolak entri baru bila whitelist sudah berisi 200 alamat', async ({ client }) => {
        const admin = await createSuperadmin()
        const now = DateTime.now()
        await IpWhitelistEntry.createMany(
            Array.from({ length: 200 }, (_, index) => ({
                value: `10.0.${Math.floor(index / 250)}.${index + 1}`,
                createdBy: admin.id,
                updatedBy: admin.id,
                createdAt: now,
                updatedAt: now,
            }))
        )

        await expectStatus(
            new PanelBrowser(client)
                .actingAs(admin)
                .post('/api/v1/ip-whitelist-entries', { value: '10.1.0.1' }),
            422
        )
    })

    test('hanya superadmin yang boleh mengelola whitelist', async ({ client }) => {
        const browser = new PanelBrowser(client).actingAs(await createUser())

        await expectStatus(browser.get('/api/v1/ip-whitelist-entries'), 403)
        await expectStatus(browser.post('/api/v1/ip-whitelist-entries', { value: '10.0.0.1' }), 403)
        await expectStatus(
            browser.put('/api/v1/security-settings', { is_ip_whitelist_enabled: false }),
            403
        )
    })

    test('memeriksa whitelist juga di langkah kode 2FA', async ({ client, assert }) => {
        await whitelist(['103.10.20.0/24'])
        await setTwoFactorRequired(true, await createSuperadmin())
        const user = await createUser({ email: 'rina@contoh.id' })
        user.twoFactorSecret = generateTotpSecret()
        user.twoFactorConfirmedAt = DateTime.now()
        await user.save()
        const browser = new PanelBrowser(client)

        await expectBody(browser.login('rina@contoh.id', undefined, '103.10.20.7'), {
            data: { status: 'two_factor_challenge' },
        })

        const response = await browser.post(
            '/api/v1/two-factor-challenges',
            { code: '123456' },
            '8.8.8.8'
        )
        response.assertStatus(403)
        response.assertBodyContains({ errors: { reason: ['ip_not_allowed'] } })
        assert.isTrue(browser.isGuest)
    })

    test('memeriksa whitelist juga di langkah pemasangan 2FA', async ({ client }) => {
        await whitelist(['103.10.20.0/24'])
        await setTwoFactorRequired(true, await createSuperadmin())
        await createUser({ email: 'rina@contoh.id' })
        const browser = new PanelBrowser(client)

        await expectBody(browser.login('rina@contoh.id', undefined, '103.10.20.7'), {
            data: { status: 'two_factor_setup' },
        })

        const response = await browser.post(
            '/api/v1/two-factor-setups',
            { code: '123456' },
            '8.8.8.8'
        )
        response.assertStatus(403)
        response.assertBodyContains({ errors: { reason: ['ip_not_allowed'] } })
    })
})
