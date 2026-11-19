import { test } from '@japa/runner'
import RobotsRules from '#services/RobotsRules'

test.group('RobotsRules', () => {
    test('mengikuti grup wildcard dan aturan paling spesifik', ({ assert }) => {
        const robots = RobotsRules.parse(
            'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\nAllow: /admin/publik\nDisallow: /*.pdf$',
            'CekCariBot/1.0'
        )

        assert.isTrue(robots.isAllowed('https://a.com/'))
        assert.isFalse(robots.isAllowed('https://a.com/admin/rahasia'))
        assert.isTrue(robots.isAllowed('https://a.com/admin/publik/info'))
        assert.isFalse(robots.isAllowed('https://a.com/berkas/katalog.pdf'))
        assert.isTrue(robots.isAllowed('https://a.com/berkas/katalog.pdf?v=2'))
    })

    test('memprioritaskan grup yang menyebut nama bot', ({ assert }) => {
        const robots = RobotsRules.parse(
            'User-agent: *\nDisallow: /\n\nUser-agent: cekcaribot\nDisallow: /privat',
            'CekCariBot/1.0'
        )

        assert.isTrue(robots.isAllowed('https://a.com/halaman'))
        assert.isFalse(robots.isAllowed('https://a.com/privat'))
    })
})
