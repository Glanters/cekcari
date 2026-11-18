import { test } from '@japa/runner'
import { matchesAny, normalizeEntry } from '#services/ip_whitelist'

test.group('Whitelist IP: pencocokan dan bentuk baku', () => {
    test('mencocokkan alamat tunggal dan rentang CIDR IPv4 maupun IPv6', ({ assert }) => {
        const entries = ['103.10.20.30', '10.8.0.0/16', '2001:db8::/32']

        assert.isTrue(matchesAny('103.10.20.30', entries))
        assert.isTrue(matchesAny('10.8.255.1', entries))
        assert.isTrue(matchesAny('2001:db8::1', entries))
        assert.isFalse(matchesAny('103.10.20.31', entries))
        assert.isFalse(matchesAny('10.9.0.1', entries))
    })

    test('mengenali alamat IPv4 yang dilaporkan dalam bentuk IPv6', ({ assert }) => {
        assert.isTrue(matchesAny('::ffff:103.10.20.7', ['103.10.20.0/24']))
        assert.isFalse(matchesAny('::ffff:8.8.8.8', ['103.10.20.0/24']))
    })

    test('tidak mencocokkan alamat yang tidak sah atau daftar kosong', ({ assert }) => {
        assert.isFalse(matchesAny('unknown', ['103.10.20.0/24']))
        assert.isFalse(matchesAny('103.10.20.7', []))
    })

    test('membakukan entri dan menolak alamat yang tidak sah', ({ assert }) => {
        assert.equal(normalizeEntry(' 10.0.0.5 '), '10.0.0.5')
        assert.equal(normalizeEntry('10.0.0.0/24'), '10.0.0.0/24')
        assert.equal(normalizeEntry('2001:DB8:0::1'), '2001:db8::1')
        assert.isNull(normalizeEntry('10.0.0.0/0'))
        assert.isNull(normalizeEntry('10.0.0.0/33'))
        assert.isNull(normalizeEntry('kantor'))
        assert.isNull(normalizeEntry('10.0.0.1/24/8'))
    })
})
