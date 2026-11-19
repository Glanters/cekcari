import { describe, expect, it } from 'vitest';
import {
    addressKeyOf,
    breadcrumbOf,
    hostOf,
    isSiteAddress,
    parseSiteAddresses,
    siteNameOf,
    splitSiteUrl,
} from './siteAddress';

describe('isSiteAddress', () => {
    it('menerima alamat polos maupun lengkap', () => {
        expect(isSiteAddress('psms.com')).toBe(true);
        expect(isSiteAddress('www.persib.co.id')).toBe(true);
        expect(isSiteAddress('https://persija.com/berita')).toBe(true);
    });

    it('menolak teks yang bukan alamat situs', () => {
        expect(isSiteAddress('persebaya')).toBe(false);
        expect(isSiteAddress('ftp://psms.com')).toBe(false);
        expect(isSiteAddress('psms .com')).toBe(false);
    });
});

describe('splitSiteUrl', () => {
    it('memisahkan skema, host, dan path dari link yang didaftarkan', () => {
        expect(splitSiteUrl('https://psms.id/players')).toEqual({ scheme: 'https://', host: 'psms.id', path: '/players' });
    });

    it('mengosongkan path untuk halaman utama', () => {
        expect(splitSiteUrl('http://psms.id')).toEqual({ scheme: 'http://', host: 'psms.id', path: '' });
    });
});

describe('breadcrumbOf', () => {
    it('menampilkan path sebagai remah alamat tanpa query', () => {
        expect(breadcrumbOf('https://dkwl.b-cdn.net/d/indrabet-kl2/register?ref=1')).toBe(
            'https://dkwl.b-cdn.net › d › indrabet-kl2 › register',
        );
        expect(breadcrumbOf('https://iana.org')).toBe('https://iana.org');
    });
});

describe('siteNameOf', () => {
    it('memakai bagian judul sebelum pemisah sebagai nama situs', () => {
        expect(siteNameOf('LINETOGEL - Situs Toto Online Terpercaya', 'https://zodiak.linetogel662.life')).toBe('LINETOGEL');
        expect(siteNameOf('Indrabet — Link Alternatif', 'https://indrabet77182.com')).toBe('Indrabet');
    });

    it('memakai host bila judul tidak punya pemisah', () => {
        expect(siteNameOf('Internet Assigned Numbers Authority', 'https://www.iana.org')).toBe('iana.org');
        expect(siteNameOf('Halo-halo Bandung', 'https://bandung.id')).toBe('bandung.id');
    });
});

describe('addressKeyOf', () => {
    it('menyamakan link yang hanya beda skema, huruf host, atau garis miring penutup', () => {
        expect(addressKeyOf('HTTPS://Psms.id/players/')).toBe('psms.id/players');
        expect(addressKeyOf('psms.id/players')).toBe('psms.id/players');
        expect(addressKeyOf('psms.id')).toBe('psms.id');
    });
});

describe('hostOf', () => {
    it('mengambil nama host dalam huruf kecil', () => {
        expect(hostOf('HTTPS://Persib.com/tiket?x=1')).toBe('persib.com');
    });
});

describe('parseSiteAddresses', () => {
    it('memecah daftar per baris seperti yang ditempel pemilik', () => {
        const entries = parseSiteAddresses('psms.com\npersija.com\npersibaya.com\npersib.com\n');

        expect(entries.map((entry) => entry.address)).toEqual(['psms.com', 'persija.com', 'persibaya.com', 'persib.com']);
        expect(entries.every((entry) => entry.isValid)).toBe(true);
    });

    it('menerima pemisah spasi, koma, dan titik koma serta membuang link ganda', () => {
        const entries = parseSiteAddresses('psms.com, https://psms.com/ ; persija.com persija.com');

        expect(entries.map((entry) => entry.host)).toEqual(['psms.com', 'persija.com']);
    });

    it('mempertahankan link berbeda path pada domain yang sama', () => {
        const entries = parseSiteAddresses('https://dkwl.b-cdn.net/latoto-kl1\nhttps://dkwl.b-cdn.net/latoto-kl2');

        expect(entries.map((entry) => entry.address)).toEqual([
            'https://dkwl.b-cdn.net/latoto-kl1',
            'https://dkwl.b-cdn.net/latoto-kl2',
        ]);
    });

    it('menandai entri yang tidak valid tanpa membuangnya', () => {
        expect(parseSiteAddresses('psms.com persebaya')).toEqual([
            { address: 'psms.com', host: 'psms.com', isValid: true },
            { address: 'persebaya', host: 'persebaya', isValid: false },
        ]);
    });
});
