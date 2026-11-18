import { test } from '@japa/runner'
import RemotePageFetcher from '#services/remote_page_fetcher'
import UrlGuard, { type HostResolver } from '#services/url_guard'
import UrlResolver from '#services/url_resolver'
import { FakeRemoteSites, htmlPage } from '#tests/fakes/remote_sites'

const publicDns: HostResolver = async () => ['93.184.216.34']

function fetcherFor(sites: FakeRemoteSites, resolver: HostResolver = publicDns) {
    return new RemotePageFetcher(new UrlGuard(resolver), new UrlResolver(), sites)
}

test.group('RemotePageFetcher', () => {
    test('mengikuti redirect dan mengembalikan alamat akhir', async ({ assert }) => {
        const sites = new FakeRemoteSites({
            'https://tokoku.com/lama': { status: 301, location: '/baru' },
            'https://tokoku.com/baru': htmlPage('<title>Baru</title>'),
        })

        const page = await fetcherFor(sites).fetch('https://Tokoku.com/lama#atas')

        assert.equal(page.url, 'https://tokoku.com/baru')
        assert.isTrue(page.isHtml())
        assert.deepEqual(sites.sentUrls, ['https://tokoku.com/lama', 'https://tokoku.com/baru'])
    })

    test('memeriksa ulang setiap tujuan redirect', async ({ assert }) => {
        const sites = new FakeRemoteSites({
            'https://tokoku.com/': { status: 302, location: 'https://internal.tokoku.com/' },
        })
        const resolver: HostResolver = async (host) =>
            host === 'internal.tokoku.com' ? ['10.0.0.5'] : ['93.184.216.34']

        await assert.rejects(
            () => fetcherFor(sites, resolver).fetch('https://tokoku.com'),
            'Alamat mengarah ke jaringan internal dan tidak dapat diproses.'
        )
        assert.deepEqual(sites.sentUrls, ['https://tokoku.com/'])
    })

    test('berhenti setelah terlalu banyak pengalihan', async ({ assert }) => {
        const sites = new FakeRemoteSites({
            'https://putar.com/*': { status: 302, location: '/lagi' },
        })

        await assert.rejects(
            () => fetcherFor(sites).fetch('https://putar.com/'),
            'Situs terlalu banyak melakukan pengalihan halaman.'
        )
        assert.lengthOf(sites.sentUrls, 4)
    })
})
