# Memasang di server uji (cari.salahmu.fun)

Panduan memasang CekCari di server Ubuntu 22.04/24.04 dengan dua domain lewat **Cloudflare Tunnel**
(DNS salahmu.fun sudah di Cloudflare), sama seperti revenue:

| Domain | Isi |
|---|---|
| `cari.salahmu.fun` | Pencarian publik |
| `panel-cari.salahmu.fun` | Panel pemilik situs |

Yang berjalan di server, semuanya lewat PM2:

| Proses | Isi |
|---|---|
| `cekcari-web` | Aplikasi web (port yang masih kosong, mis. 3345; hanya localhost; publik lewat tunnel) |
| `cekcari-queue` | Worker antrean PostgreSQL: crawl situs dan crawl ulang mingguan |

Server uji memakai **login dummy** (Account Center asli belum tersambung) dan **tidak diindeks Google**
(`SEO_ALLOW_INDEXING=false`). Logo situs tidak disimpan di server: ditampilkan langsung dari domain
pemilik situs, jadi tidak perlu S3/Spaces.

## 1. Paket di server

```bash
sudo apt update && sudo apt install -y git postgresql redis-server chrony
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
```

`chrony` menjaga jam server tepat; kode Google Authenticator (2FA) bergantung pada jam.
Redis bawaan Ubuntu hanya mendengarkan di localhost, jadi tidak perlu password.

## 2. Database

Ganti `GANTI_PASSWORD_DB` dengan password acak (mis. hasil `openssl rand -hex 24`):

```bash
sudo -u postgres psql -c "CREATE USER cekcari WITH PASSWORD 'GANTI_PASSWORD_DB';"
sudo -u postgres psql -c "CREATE DATABASE cekcari OWNER cekcari;"
```

## 3. Kode dan `.env`

```bash
cd /opt && sudo git clone https://github.com/Glanters/cekcari.git && sudo chown -R $USER cekcari
cd /opt/cekcari && npm ci
cp .env.example .env && node ace generate:key && nano .env
```

Server ini juga menjalankan aplikasi lain (revenue, LiveChat Audit, hrms), jadi pilih port yang
masih kosong. Perintah berikut tidak boleh mencetak apa pun untuk port yang dipilih (contoh 3345):

```bash
sudo ss -ltnp | grep ':3345 '
```

Ubah isi `.env` menjadi seperti ini (APP_KEY sudah diisi oleh `generate:key`). **Semua** baris di
bawah wajib diubah, termasuk `PORT`; nilai bawaan `.env.example` (port 3333, domain localhost)
hanya untuk komputer pengembangan:

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3345
LOG_LEVEL=info

SEARCH_DOMAIN=cari.salahmu.fun
PANEL_DOMAIN=panel-cari.salahmu.fun
SEARCH_URL=https://cari.salahmu.fun
# Server uji: jangan diindeks Google. Di cekcari.com isi true.
SEO_ALLOW_INDEXING=false

SESSION_DRIVER=redis
LIMITER_STORE=redis

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=cekcari
DB_PASSWORD=GANTI_PASSWORD_DB
DB_DATABASE=cekcari

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_KEY_PREFIX=cekcari:

# cloudflared berjalan di server yang sama, jadi hanya localhost yang dipercaya sebagai proxy.
TRUSTED_PROXIES=127.0.0.1,::1

# Login uji: dummy dinyalakan eksplisit. Hapus tiga baris ini saat Account Center asli tersedia.
ACCOUNTCENTER_DRIVER=dummy
ACCOUNTCENTER_DUMMY_IN_PRODUCTION=true
ACCOUNTCENTER_DUMMY_PASSWORD=<minimal 16 karakter, mis. hasil: openssl rand -base64 18>
ACCOUNTCENTER_SUPERADMIN_EMAILS=<email Anda, pisahkan koma bila lebih dari satu>
```

## 4. Build, migrasi, jalankan

Jalankan satu per satu:

```bash
cd /opt/cekcari && node ace build
cd /opt/cekcari/build && npm ci --omit=dev
cd /opt/cekcari/build && ENV_PATH=../ node ace migration:run --force
cd /opt/cekcari && pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # lalu jalankan perintah sudo yang dicetaknya, agar PM2 hidup lagi setelah reboot
```

Cek:

```bash
pm2 status
curl -s -H "Host: cari.salahmu.fun" http://127.0.0.1:3345/up
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: panel-cari.salahmu.fun" http://127.0.0.1:3345/masuk
```

Hasil yang benar: dua proses `online`, `{"status":"ok"}`, dan `200`. Bila `curl` gagal atau
menampilkan aplikasi lain, lihat `pm2 logs cekcari-web --lines 30 --nostream`: pesan `EADDRINUSE`
berarti port sudah dipakai aplikasi lain, jadi ganti `PORT` di `.env` lalu `pm2 restart ecosystem.config.cjs`.

## 5. Domain lewat Cloudflare Tunnel

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels**. Pakai tunnel server yang sudah ada,
   atau **Create a tunnel** (Cloudflared) lalu jalankan perintah instal yang diberikan, contoh:
   ```bash
   sudo cloudflared service install <TOKEN_DARI_DASHBOARD>
   ```
2. Di tunnel itu → **Public Hostname → Add**, dua kali:
   - Subdomain `cari`, Domain `salahmu.fun`, Service **HTTP**, URL `127.0.0.1:3345`
   - Subdomain `panel-cari`, Domain `salahmu.fun`, Service **HTTP**, URL `127.0.0.1:3345`

   Tulis `127.0.0.1`, bukan `localhost`: aplikasi hanya mendengarkan di IPv4, sedangkan `localhost`
   bisa diarahkan ke IPv6.

Satu aplikasi melayani kedua domain; aplikasi membedakannya dari nama host.

## 6. Setelah online

- Buka https://cari.salahmu.fun → beranda pencarian.
- Buka https://panel-cari.salahmu.fun → masuk dengan email superadmin dan password dummy.
  2FA sedang mati (masa uji); nyalakan di menu **Keamanan** bila ingin mencobanya.
- Tambahkan situs, tunggu sekitar satu menit, lalu cari di domain pencarian.
- Log: `pm2 logs cekcari-web` dan `pm2 logs cekcari-queue`.
- Pastikan tidak diindeks: https://cari.salahmu.fun/robots.txt harus berisi `Disallow: /`.

## Update setelah ada perubahan kode

```bash
cd /opt/cekcari && git pull && npm ci && node ace build
cd /opt/cekcari/build && npm ci --omit=dev && ENV_PATH=../ node ace migration:run --force
cd /opt/cekcari && pm2 reload ecosystem.config.cjs
```

## Pindah ke production (cekcari.com)

Ulangi langkah yang sama dengan `SEARCH_DOMAIN=cekcari.com`, `SEARCH_URL=https://cekcari.com`,
`SEO_ALLOW_INDEXING=true`, Account Center asli (`ACCOUNTCENTER_DRIVER=http` + `URI`/`NAME`/`SECRET`,
tanpa `ACCOUNTCENTER_DUMMY_IN_PRODUCTION`), lalu nyalakan 2FA di menu **Keamanan**.
