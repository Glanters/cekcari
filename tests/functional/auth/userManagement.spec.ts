import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import { accountCenter } from '#config/cekcari'
import { PERMISSIONS, hasPermission, isSuperadmin } from '#services/permissions'
import { isTwoFactorRequired } from '#services/twoFactorPolicy'
import {
    PanelBrowser,
    expectStatus,
    createSuperadmin,
    createUser,
    resetLimiters,
} from '#tests/functional/auth/authHelpers'

test.group('Kelola pengguna dan keamanan', (group) => {
    const originalSuperadminEmails = accountCenter.superadminEmails

    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(async () => {
        await resetLimiters()

        return () => {
            accountCenter.superadminEmails = originalSuperadminEmails
        }
    })

    test('hanya superadmin yang boleh mengelola pengguna dan keamanan', async ({
        client,
        assert,
    }) => {
        const member = await createUser()
        const other = await createUser()
        const browser = new PanelBrowser(client).actingAs(member)

        await expectStatus(browser.get('/api/v1/users'), 403)
        await expectStatus(
            browser.put(`/api/v1/users/${other.id}/activation`, { is_active: false }),
            403
        )
        await expectStatus(
            browser.put(`/api/v1/users/${other.id}/role`, { role: 'superadmin' }),
            403
        )
        await expectStatus(browser.get('/api/v1/security-settings'), 403)
        await expectStatus(
            browser.put('/api/v1/security-settings', { is_two_factor_required: false }),
            403
        )

        await other.refresh()
        assert.isTrue(other.isActive)
    })

    test('superadmin punya izin kelola situs semua member, member tidak', async ({ assert }) => {
        const superadmin = await createSuperadmin()
        const member = await createUser()

        assert.isTrue(await hasPermission(superadmin, PERMISSIONS.viewAllDomains))
        assert.isTrue(await hasPermission(superadmin, 'domains.manage_all'))
        assert.isFalse(await hasPermission(member, 'domains.view_all'))
        assert.isFalse(await hasPermission(member, PERMISSIONS.manageAllDomains))
        assert.isFalse(await hasPermission(superadmin, 'izin.tidak_ada'))
    })

    test('menampilkan akun yang menunggu aktivasi paling atas', async ({ client, assert }) => {
        const admin = await createSuperadmin()
        await createUser({ name: 'Sudah Aktif' })
        const pending = await createUser({ name: 'Menunggu', activatedAt: null })
        const browser = new PanelBrowser(client).actingAs(admin)

        const response = await browser.get('/api/v1/users')

        response.assertStatus(200)
        const data = response.body().data
        assert.equal(data.items[0].id, pending.id)
        assert.isFalse(data.items[0].is_active)
        assert.equal(data.pending_count, 1)
        assert.equal(data.pagination.total, 3)
        assert.sameMembers(Object.keys(data.items[0]), [
            'id',
            'name',
            'email',
            'avatar_url',
            'role',
            'is_active',
            'has_two_factor',
            'domains_count',
            'activated_at',
            'last_login_at',
            'created_at',
        ])
        assert.equal(data.items[0].domains_count, 0)

        const filtered = await browser.get('/api/v1/users?status=pending&q=NUNGGU')
        filtered.assertStatus(200)
        assert.lengthOf(filtered.body().data.items, 1)
    })

    test('mengaktifkan dan menonaktifkan akun', async ({ client, assert }) => {
        const admin = await createSuperadmin()
        const user = await createUser({ activatedAt: null })
        const browser = new PanelBrowser(client).actingAs(admin)

        const activated = await browser.put(`/api/v1/users/${user.id}/activation`, {
            is_active: true,
        })
        activated.assertStatus(200)
        activated.assertBodyContains({ data: { is_active: true } })

        await user.refresh()
        assert.isTrue(user.isActive)
        assert.equal(user.updatedBy, admin.id)

        const deactivated = await browser.put(`/api/v1/users/${user.id}/activation`, {
            is_active: false,
        })
        deactivated.assertStatus(200)
        deactivated.assertBodyContains({ data: { is_active: false } })
    })

    test('mencegah superadmin menonaktifkan atau menurunkan dirinya sendiri', async ({
        client,
        assert,
    }) => {
        const admin = await createSuperadmin()
        const browser = new PanelBrowser(client).actingAs(admin)

        await expectStatus(
            browser.put(`/api/v1/users/${admin.id}/activation`, { is_active: false }),
            422
        )
        await expectStatus(browser.put(`/api/v1/users/${admin.id}/role`, { role: 'member' }), 422)

        await admin.refresh()
        assert.isTrue(admin.isActive)
        assert.isTrue(await isSuperadmin(admin))
    })

    test('mengubah peran akun lain', async ({ client, assert }) => {
        const admin = await createSuperadmin()
        const user = await createUser()
        const browser = new PanelBrowser(client).actingAs(admin)

        const response = await browser.put(`/api/v1/users/${user.id}/role`, { role: 'superadmin' })
        response.assertStatus(200)
        response.assertBodyContains({ data: { role: 'superadmin' } })
        assert.isTrue(await isSuperadmin(user))

        await expectStatus(browser.put(`/api/v1/users/${user.id}/role`, { role: 'raja' }), 422)
    })

    test('superadmin bisa menyalakan dan mematikan kewajiban 2FA', async ({ client, assert }) => {
        const browser = new PanelBrowser(client).actingAs(await createSuperadmin())

        const current = await browser.get('/api/v1/security-settings')
        current.assertStatus(200)
        current.assertBodyContains({ data: { is_two_factor_required: false } })

        const updated = await browser.put('/api/v1/security-settings', {
            is_two_factor_required: true,
        })
        updated.assertStatus(200)
        updated.assertBodyContains({ data: { is_two_factor_required: true } })

        assert.isTrue(await isTwoFactorRequired())
    })

    test('mereset 2FA pengguna sehingga login berikutnya diminta memasang ulang', async ({
        client,
        assert,
    }) => {
        const admin = await createSuperadmin()
        const user = await createUser({ email: 'rina@contoh.id' })
        user.twoFactorSecret = 'JBSWY3DPEHPK3PXP'
        user.twoFactorRecoveryCodes = [await hash.make('abcde-12345')]
        user.twoFactorConfirmedAt = DateTime.now()
        user.twoFactorLastStep = 123
        await user.save()

        const response = await new PanelBrowser(client)
            .actingAs(admin)
            .delete(`/api/v1/users/${user.id}/two-factor`)
        response.assertStatus(200)
        response.assertBodyContains({ data: { has_two_factor: false } })

        const fresh = await User.findOrFail(user.id)
        assert.isNull(fresh.twoFactorSecret)
        assert.isNull(fresh.twoFactorRecoveryCodes)
        assert.isNull(fresh.twoFactorLastStep)
        assert.equal(fresh.updatedBy, admin.id)

        await expectStatus(
            new PanelBrowser(client)
                .actingAs(await createUser())
                .delete(`/api/v1/users/${user.id}/two-factor`),
            403
        )
    })

    test('menolak menonaktifkan atau menurunkan superadmin utama dari .env', async ({
        client,
        assert,
    }) => {
        accountCenter.superadminEmails = 'bos@contoh.id'
        const admin = await createSuperadmin()
        const root = await createSuperadmin({ email: 'bos@contoh.id' })
        const browser = new PanelBrowser(client).actingAs(admin)

        await expectStatus(
            browser.put(`/api/v1/users/${root.id}/activation`, { is_active: false }),
            422
        )
        await expectStatus(browser.put(`/api/v1/users/${root.id}/role`, { role: 'member' }), 422)

        await root.refresh()
        assert.isTrue(root.isActive)
        assert.isTrue(await isSuperadmin(root))
    })

    test('menjawab 404 untuk pengguna yang tidak ada', async ({ client }) => {
        const browser = new PanelBrowser(client).actingAs(await createSuperadmin())

        await expectStatus(browser.put('/api/v1/users/999999/activation', { is_active: true }), 404)
    })
})
