# Memasang di server (manual)

CekCari di server Ubuntu 22.04/24.04 dengan PostgreSQL, Redis, PM2, dan Nginx. Semua langkah dikerjakan
manual (tidak ada skrip pemasang otomatis dan tidak memakai Docker).

| Domain | Isi |
|---|---|
| Domain pencarian (`SEARCH_DOMAIN`) | Pencarian publik |
| Domain panel (`PANEL_DOMAIN`) | Panel pemilik situs |

## 1. Paket sekali pasang

```bash
sudo apt update && sudo apt install -y git postgresql redis-server chrony nginx certbot dnsutils
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Database dan Redis

Buat user dan database PostgreSQL, lalu pastikan `redis-cli ping` menjawab `PONG`.

## 3. Berkas `.env`

Salin `.env.example` ke `.env` di folder proyek, lalu isi: `APP_KEY` (acak, minimal 32 karakter), domain,
`DB_*`, `REDIS_*`, `TRUSTED_PROXIES`, dan Account Center asli (`ACCOUNTCENTER_DRIVER=http`,
`ACCOUNTCENTER_URI`, `ACCOUNTCENTER_NAME`, `ACCOUNTCENTER_SECRET`, `ACCOUNTCENTER_SUPERADMIN_EMAILS`).
Atur izin `chmod 600 .env`. Jangan pernah meng-commit `.env` atau salinannya.

Login dummy (`ACCOUNTCENTER_DRIVER=dummy`) hanya untuk server uji. Jangan dipakai di production.

## 4. Build, migrasi, dan jalankan

```bash
cd /opt/cekcari
npm ci
node ace build
(cd build && npm ci --omit=dev)
(cd build && ENV_PATH=../ node ace migration:run --force)
(cd build && ENV_PATH=../ node ace db:seed)
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

`db:seed` membuat superadmin pertama (`SuperadminSeeder`) dan aman dijalankan ulang. Update setelah ada perubahan kode: `git pull`, lalu ulangi langkah di atas.

| Proses PM2 | Isi |
|---|---|
| `cekcari-web` | Aplikasi web (hanya localhost; publik lewat Nginx) |
| `cekcari-queue` | Worker antrean PostgreSQL: crawl situs dan crawl ulang mingguan |

## 5. Nginx dan sertifikat

Templat ada di `deploy/nginx/cekcari.conf`; `deploy/setup-domain.sh` memasangnya dari nilai `.env`:

```bash
sudo bash deploy/setup-domain.sh --letsencrypt
```

Bila domain harus selalu lewat Cloudflare, pakai Origin Certificate: simpan ke
`/etc/ssl/cloudflare/cekcari.pem` dan `/etc/ssl/cloudflare/cekcari.key`, lalu
`sudo bash deploy/setup-domain.sh --cloudflare`.

Bila sertifikat gagal terbit: pastikan A record menunjuk ke IP server, domain tidak lagi ada di
Cloudflare Tunnel, dan record sementara **DNS only** (bukan Proxied) selama sertifikat diterbitkan.

## Pindah domain (mis. dari server uji ke cekcari.com)

1. **DNS:** buat A record `cekcari.com`, `www.cekcari.com`, dan `panel.cekcari.com` ke IP server.
2. **Akun dummy:** bila server uji memakai akun dummy, hapus dulu selagi login dummy masih aktif:
   `cd /opt/cekcari/build && ENV_PATH=../ node ace user:create-dummies --remove`
3. **`.env`:**

   ```dotenv
   NODE_ENV=production
   SEARCH_DOMAIN=cekcari.com
   PANEL_DOMAIN=panel.cekcari.com
   SEARCH_URL=https://cekcari.com
   SEO_ALLOW_INDEXING=true
   ACCOUNTCENTER_DRIVER=http
   ACCOUNTCENTER_DUMMY_IN_PRODUCTION=false
   ```

   Isi juga `ACCOUNTCENTER_URI`, `ACCOUNTCENTER_NAME`, `ACCOUNTCENTER_SECRET`, dan
   `ACCOUNTCENTER_SUPERADMIN_EMAILS` dengan data Account Center asli.
4. **Jalankan ulang aplikasi** dengan `.env` baru: `pm2 startOrRestart ecosystem.config.cjs --update-env`.
5. **Nginx dan sertifikat:** `sudo bash deploy/setup-domain.sh`. Sertifikat diterbitkan ulang untuk domain
   baru, dan `www.cekcari.com` dialihkan 301 ke `https://cekcari.com`.
6. **Google:** daftarkan `https://cekcari.com` di Google Search Console, isi `GOOGLE_SITE_VERIFICATION`,
   jalankan ulang langkah 4, lalu kirim `https://cekcari.com/sitemap.xml`.

Semua pengguna perlu masuk ulang di `https://panel.cekcari.com/masuk`, karena sesi terikat ke domain lama.

## Setelah naik production

- Nyalakan 2FA di menu **Keamanan** panel.
- Server selain `cekcari.com` tidak diindeks Google (`/robots.txt` berisi `Disallow: /`).

## Perintah berguna

```bash
cd /opt/cekcari/build && ENV_PATH=../ node ace domains:refresh-icons   # baca ulang favicon semua situs
cd /opt/cekcari/build && ENV_PATH=../ node ace user:create-dummies     # akun uji; menolak jalan bila memakai Account Center asli
pm2 status
pm2 logs cekcari-web --lines 50 --nostream
pm2 logs cekcari-queue --lines 50 --nostream
```
