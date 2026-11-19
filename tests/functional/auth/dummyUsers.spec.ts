import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import UserCreateDummies from '#commands/UserCreateDummies'
import { accountCenter } from '#config/cekcari'
import { isSuperadmin } from '#services/permissions'

test.group('Akun dummy untuk server uji', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.setup(() => {
        const originalDriver = accountCenter.driver

        return () => {
            accountCenter.driver = originalDriver
        }
    })

    test('membuat 1 superadmin dan 5 member yang langsung aktif, aman diulang', async ({ assert }) => {
        accountCenter.driver = 'dummy'

        for (let run = 1; run <= 2; run++) {
            const command = await ace.create(UserCreateDummies, [])
            await command.exec()
            command.assertSucceeded()
        }

        const users = await User.query().whereILike('email', '%@dummy.test').orderBy('email')
        assert.lengthOf(users, 6)
        assert.isTrue(users.every((user) => user.isActive))

        const superadmins = []
        for (const user of users) {
            if (await isSuperadmin(user)) {
                superadmins.push(user.email)
            }
        }
        assert.deepEqual(superadmins, ['superadmin@dummy.test'])
    })

    test('menolak membuat akun dummy bila login memakai Account Center asli', async ({
        assert,
    }) => {
        accountCenter.driver = 'http'

        const command = await ace.create(UserCreateDummies, [])
        await command.exec()

        command.assertFailed()
        assert.lengthOf(await User.query().whereILike('email', '%@dummy.test'), 0)
    })
})
