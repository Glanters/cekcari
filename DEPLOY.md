# Memasang di server (cari.salahmu.fun)

CekCari di server Ubuntu 22.04/24.04, dengan Nginx dan sertifikat Let's Encrypt:

| Domain | Isi |
|---|---|
| `cari.salahmu.fun` | Pencarian publik |
| `panel-cari.salahmu.fun` | Panel pemilik situs |

## Cara cepat (sekali jalan)

Sekali saja, pasang paket:

```bash
sudo apt update && sudo apt install -y git postgresql redis-server chrony nginx certbot dnsutils
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
```

Di Cloudflare (salahmu.fun → DNS), buat dua **A record** ke IP server ini (`curl -s https://api.ipify.org`):
`cari` dan `panel-cari`. Bila keduanya pernah ditambahkan di Zero Trust → Tunnels → Public Hostname,
hapus dari tunnel itu dulu — selama masih di tunnel, domain menampilkan aplikasi lain.

Lalu:

```bash
cd /opt && sudo git clone https://github.com/Glanters/cekcari.git && sudo chown -R $USER cekcari
cd /opt/cekcari && bash deploy/server_setup.sh
```

Skrip ini membuat `.env` lengkap (nilai lama yang benar dipertahankan, cadangan `.env.bak.*`), memilih
port yang masih kosong, menyiapkan user & database PostgreSQL, build, migrasi, menjalankan PM2,
memasang Nginx + sertifikat Let's Encrypt untuk kedua domain, mengecek semuanya, lalu mencetak
email & password login. Satu-satunya pertanyaan: email superadmin. Aman dijalankan ulang.

Update setelah ada perubahan kode — perintah yang sama:

```bash
cd /opt/cekcari && git pull && bash deploy/server_setup.sh
```

Yang berjalan di server, lewat PM2:

| Proses | Isi |
|---|---|
| `cekcari-web` | Aplikasi web (port kosong mulai 3345, hanya localhost; publik lewat Nginx) |
| `cekcari-queue` | Worker antrean PostgreSQL: crawl situs dan crawl ulang mingguan |

Server uji memakai **login dummy** (Account Center asli belum tersambung), **2FA mati** selama masa uji
(nyalakan di menu Keamanan), dan **tidak diindeks Google**. Logo situs tidak disimpan di server:
ditampilkan langsung dari domain pemilik situs.

## Bila sertifikat gagal terbit

Skrip mencetak penyebabnya. Yang paling sering:

- Domain masih di Public Hostname Cloudflare Tunnel → hapus dari tunnel.
- A record belum ada / belum menunjuk IP server ini.
- Record diproksi Cloudflare (awan jingga) dengan "Always Use HTTPS" → ubah ke **DNS only** (awan
  abu-abu), jalankan ulang skripnya, lalu boleh dikembalikan ke Proxied dengan SSL/TLS **Full (strict)**.

Bila domain memang harus selalu lewat Cloudflare, bisa juga memakai Origin Certificate (15 tahun):
buat di SSL/TLS → Origin Server untuk kedua hostname, simpan ke `/etc/ssl/cloudflare/cekcari.pem` dan
`/etc/ssl/cloudflare/cekcari.key`, lalu `sudo bash deploy/setup-domain.sh --cloudflare`.

## Akun uji (dummy)

Satu superadmin dan 5 member yang langsung aktif, semuanya memakai password dummy dari `.env`:

```bash
cd /opt/cekcari/build && ENV_PATH=../ node ace user:create-dummies
```

Email: `superadmin@dummy.test`, `member1@dummy.test` … `member5@dummy.test`. Jumlah member bisa diubah
(`--members=10`), dan semuanya dihapus lagi dengan `--remove` (situs milik akun dummy ikut terhapus).
Perintah ini menolak berjalan bila server memakai Account Center asli.

## Baca ulang favicon semua situs

Ikon di hasil pencarian memakai favicon tiap situs (logo besar `apple-touch-icon` hanya cadangan).
Ikon diperbarui otomatis saat crawl mingguan; untuk memperbarui semuanya sekarang:

```bash
cd /opt/cekcari/build && ENV_PATH=../ node ace domains:refresh-icons
```

## Cek & log

```bash
pm2 status
pm2 logs cekcari-web --lines 50 --nostream
pm2 logs cekcari-queue --lines 50 --nostream
```

- https://cari.salahmu.fun → beranda pencarian.
- https://panel-cari.salahmu.fun/masuk → login dengan email superadmin + password dari akhir skrip.
- https://cari.salahmu.fun/robots.txt harus berisi `Disallow: /` (server uji tidak diindeks).

## Pindah ke production (cekcari.com)

```bash
SEARCH_DOMAIN=cekcari.com PANEL_DOMAIN=panel.cekcari.com bash deploy/server_setup.sh
```

Lalu di `.env` ganti login dummy dengan Account Center asli (`ACCOUNTCENTER_DRIVER=http`, isi
`ACCOUNTCENTER_URI`/`NAME`/`SECRET`), jalankan skripnya sekali lagi, dan nyalakan 2FA di menu
**Keamanan**. Skrip mempertahankan Account Center asli yang sudah terisi pada setiap update, dan
`cekcari.com` otomatis boleh diindeks.
