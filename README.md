# CekCari — Search Engine Domain

Mesin pencari situs dengan dua panel yang dilayani di **dua domain terpisah** (`SEARCH_DOMAIN` dan `PANEL_DOMAIN` di `.env`):

- **Pencarian publik** — domain pencarian (`/`, `/cari`). Pengunjung mencari situs; data diambil dari PostgreSQL (data situs + isi halaman hasil crawl), lengkap dengan saran pencarian, sorotan kata kunci, dan toleransi salah ketik. Tidak ada tautan atau API login di domain ini.
- **Panel pemilik domain** — domain panel (`/masuk`, `/dasbor/domain`). Pemilik masuk lewat **Account Center** lalu **hanya mengisi link situs**; judul, deskripsi, tag, dan logo diambil otomatis dari situs, dan crawler mengindeks halaman-halamannya.

Tiap domain punya bundel Vue sendiri (`resources/js/search.js` dan `resources/js/panel.js`) dan rute API sendiri; rute domain lain menjawab 404. Di lokal: pencarian di `http://localhost:8000`, panel di `http://panel.localhost:8000`.

Standar pengembangan: [03-standar-untuk-ai.md](03-standar-untuk-ai.md).

## Teknologi

Laravel 13 (Sanctum, Pest) · Vue 3 + Vue Router + Pinia + Reka UI + VeeValidate + TanStack Table + Lucide + Day.js · Tailwind CSS 4 · Vite · PostgreSQL 17 (full-text search + `pg_trgm`) · Redis (cache, sesi, rate limit; klien `predis`) · MinIO (dev) / DigitalOcean Spaces (production) untuk logo.

## Menjalankan di lokal

Prasyarat: PHP 8.3 (ekstensi `pdo_pgsql`, `dom`, `curl`), Composer, Node.js 22+, Docker.

1. Salin `.env.example` menjadi `.env`, isi `DB_PASSWORD`, `REDIS_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, lalu `php artisan key:generate`.
2. Nyalakan PostgreSQL, Redis, dan MinIO (bucket + akses baca publik `logos/` dibuat otomatis):

    ```
    docker compose up -d
    ```

3. Pasang dependensi dan siapkan database:

    ```
    composer install
    npm install
    php artisan migrate
    ```

4. Jalankan aplikasi (tiga proses):

    ```
    php artisan serve
    php artisan queue:work database
    npm run dev
    ```

5. Jadwal crawl ulang mingguan: `php artisan schedule:work` (production: cron `schedule:run` tiap menit).

## Alur pemilik domain

1. Masuk lewat Account Center (akun harus sudah diaktifkan superadmin) → di **Domain saya** tulis alamat situs, boleh polos (`psms.com`) atau lengkap (`https://psms.com`). Beberapa situs bisa ditempel sekaligus, satu per baris (maks. 20 per kali). Alamat polos dicoba lewat https, lalu http bila https tidak bisa dibuka.
2. Server membaca halaman utama situs: judul (`<title>`, cadangan: nama host), deskripsi (meta description, cadangan: cuplikan isi halaman), tag (meta keywords), dan logo (`apple-touch-icon`/`icon`, cadangan `/favicon.ico`). Situs yang tidak bisa dibuka ditolak dengan pesan di kolom link.
3. Domain langsung tampil di pencarian; crawl pertama masuk antrean (PostgreSQL, dalam transaksi yang sama). Crawler menelusuri maksimal `CRAWLER_MAX_PAGES` halaman pada host yang sama, mematuhi `robots.txt`, dan memperbarui judul/deskripsi/tag setiap kali berjalan (otomatis tiap minggu atau lewat tombol **Perbarui data sekarang**).
4. Satu domain boleh punya beberapa entri dengan path berbeda (mis. `dkwl.b-cdn.net/latoto-kl1` dan `/latoto-kl2`), tetapi link yang sama hanya bisa didaftarkan sekali (http/https, huruf besar, dan garis miring penutup dianggap sama). Bila link punya path, crawler hanya menelusuri halaman di bawah path itu. Tidak ada verifikasi kepemilikan.

## Urutan hasil dan promosi

- **Rolling:** halaman pencarian mengirim `seed` acak milik pengunjung (disimpan di `sessionStorage`, berganti tiap 30 menit). Hasil diurutkan `md5(id || seed)`, jadi tiap pengunjung melihat urutan berbeda tetapi halaman 2, 3, dst. tetap konsisten. Tanpa `seed` (pemanggil API langsung) hasil diurutkan menurut kecocokan.
- **Promosi:** pemilik menyalakan **Promosikan link ini** di halaman detail domain. Bila kata kunci cocok, satu link promosi dipilih acak (mengikuti seed) dan tampil di slot teratas berlabel **Promosi** pada halaman 1; link itu tidak diulang di daftar biasa.

## SEO (cekcari.com)

Yang sudah ditangani aplikasi:

- Judul, meta description, canonical, Open Graph, dan data terstruktur `WebSite`/`Organization` dirender di server (`SpaPageController`, `resources/views/app.blade.php`), jadi terbaca mesin pencari tanpa menjalankan JavaScript. Teks dasarnya di `config/seo.php`.
- Beranda diindeks; halaman hasil pencarian (`/cari?q=…`) diberi `noindex, follow` sesuai anjuran Google untuk hasil pencarian internal; alamat yang tidak ada menjawab **404** sungguhan.
- `robots.txt` dan `sitemap.xml` dibuat per domain. Domain panel seluruhnya `Disallow: /` plus header `X-Robots-Tag: noindex, nofollow`.

Saat go-live di cekcari.com:

1. Isi `.env`: `SEARCH_DOMAIN=cekcari.com`, `SEARCH_URL=https://cekcari.com`, dan domain panel (`PANEL_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`).
2. Pasang HTTPS, lalu arahkan `www.cekcari.com` dan `http://` ke `https://cekcari.com` dengan redirect 301 di web server, supaya Google hanya melihat satu alamat.
3. Daftarkan `https://cekcari.com` di [Google Search Console](https://search.google.com/search-console), salin kode verifikasi ke `GOOGLE_SITE_VERIFICATION`, lalu kirim `https://cekcari.com/sitemap.xml`.
4. Jangan daftarkan domain panel di Search Console.

## Aplikasi terpasang (PWA)

Domain pencarian bisa dipasang ke layar utama ponsel dan dibuka seperti aplikasi (tanpa bilah alamat). Panel pemilik sengaja tidak dijadikan PWA.

- **Android/Chrome**: muncul ajakan "Pasang CekCari" di bawah layar; tombol **Pasang** membuka dialog pemasangan asli browser.
- **iPhone/iPad (Safari)**: iOS tidak punya dialog otomatis, jadi ditampilkan petunjuk "Ketuk Bagikan lalu pilih Tambah ke Layar Utama".
- Ajakan tidak muncul lagi selama 30 hari setelah ditutup, dan tidak pernah muncul di dalam aplikasi yang sudah terpasang.
- **Offline**: setelah satu kali kunjungan, beranda dan tampilan aplikasi tetap terbuka tanpa internet. Hasil pencarian selalu diambil langsung dari server (tidak pernah disimpan), jadi saat offline yang tampil adalah pesan "periksa koneksi" dengan tombol muat ulang.

Berkasnya: `public/manifest.webmanifest`, `public/sw.js` (service worker tulisan sendiri, tanpa library), ikon di `public/images/brand/pwa-*.png`, logika di `resources/js/lib/pwa.js`, tampilan ajakan di `resources/js/components/InstallAppPrompt.vue`.

Catatan:

- Service worker didaftarkan sebagai `/sw.js?build=<nama berkas build>`, sehingga **setiap `npm run build` otomatis memicu pembaruan** di browser pengunjung. Berkas build lama dibuang dari cache. Tidak perlu mengubah `sw.js` saat merilis kode baru.
- Naikkan `CACHE_VERSION` di `public/sw.js` hanya bila strategi cache-nya sendiri diubah.
- PWA hanya aktif di HTTPS (atau `localhost`). Web server production jangan menyimpan `sw.js` di cache terlalu lama (mis. `Cache-Control: no-cache` untuk `/sw.js`).
- Pemasangan di Android hanya bisa diuji di Chrome sungguhan atau ponsel; browser bawaan editor tidak memunculkan dialog pemasangan.

## Login: Account Center, aktivasi, dan 2FA

Tidak ada pendaftaran atau kata sandi lokal. Alurnya:

1. Pengguna mengisi email + kata sandi **Account Center** di `/masuk`. CekCari meneruskannya ke Account Center (protokol AES-256-CBC + tanda tangan, sama dengan dash CRM; dijaga test vektor di `tests/Feature/AccountCenterTest.php`). Jawaban yang tidak dikenali selalu ditolak.
2. Login pertama membuat akun lokal berperan **member** dengan status **belum aktif**. Pengguna belum bisa masuk sampai **superadmin** mengaktifkannya di menu **Pengguna**.
3. Bila 2FA diwajibkan, pengguna memasukkan kode Google Authenticator/Authy. Yang belum pernah memasang 2FA diminta memindai QR dulu, lalu mendapat 8 recovery code (sekali pakai, disimpan dalam bentuk hash).

Peran memakai Spatie Laravel Permission: `superadmin` dan `member`. Superadmin bisa:

- mengaktifkan/menonaktifkan akun (akun yang dinonaktifkan langsung keluar dari sesi yang sedang berjalan),
- menjadikan akun lain superadmin atau member (tidak bisa mengubah atau menonaktifkan dirinya sendiri),
- **mereset 2FA** pengguna yang ponselnya hilang/ganti (menu **Pengguna** → *Reset 2FA*): kunci dan recovery code lama langsung tidak berlaku, dan saat 2FA diwajibkan pengguna diminta memindai QR baru ketika masuk berikutnya,
- menyalakan/mematikan kewajiban 2FA untuk semua akun di menu **Keamanan**,
- mengelola **whitelist IP** di menu **Keamanan**.

### Whitelist IP

Sama seperti lacak-hp: satu daftar global berisi alamat IP atau rentang CIDR (IPv4/IPv6) beserta keterangan, dengan sakelar nyala/mati.

- Saat aktif, **member** hanya bisa masuk dan memakai panel dari alamat di daftar. Diperiksa saat login **dan** di setiap permintaan, jadi member yang pindah ke jaringan lain langsung keluar.
- **Superadmin selalu dikecualikan**, supaya pengelola tidak bisa mengunci dirinya sendiri dan selalu bisa memperbaiki daftar.
- Pencarian publik tidak pernah dibatasi.
- Whitelist tidak bisa dinyalakan selama daftar kosong, dan alamat terakhir tidak bisa dihapus selama whitelist aktif.
- Di production di belakang nginx/load balancer, **wajib isi `TRUSTED_PROXIES`** (mis. `127.0.0.1`), supaya aplikasi membaca IP asli pengunjung dari `X-Forwarded-For`, bukan IP proxy. Hanya proxy di daftar ini yang dipercaya.

**Masa uji: 2FA saat ini dimatikan.** Nyalakan di menu **Keamanan** sebelum CekCari dipakai umum. Kunci 2FA yang sudah dipasang pengguna tetap tersimpan saat 2FA dimatikan.

Pengaturan `.env`:

| Kunci | Isi |
|---|---|
| `ACCOUNTCENTER_DRIVER` | `http` (Account Center sungguhan) atau `dummy` (hanya uji; **otomatis diabaikan bila `APP_ENV=production`**) |
| `ACCOUNTCENTER_URI` / `_NAME` / `_SECRET` | Alamat (wajib https), nama klien, dan kunci rahasia dari tim Account Center |
| `ACCOUNTCENTER_DUMMY_PASSWORD` | Kata sandi yang diterima Account Center dummy untuk email apa pun |
| `ACCOUNTCENTER_SUPERADMIN_EMAILS` | Email superadmin awal (dipisah koma); otomatis aktif sebagai superadmin saat login. Tanpa ini tidak ada yang bisa mengaktifkan akun pertama |

Lokal saat ini memakai driver `dummy`: masuk dengan `pemilik.uji@example.com` (superadmin) atau email lain apa pun, kata sandinya nilai `ACCOUNTCENTER_DUMMY_PASSWORD` di `.env`. Email lain akan berstatus belum aktif sampai diaktifkan.

## Keamanan yang perlu diketahui

- Semua permintaan ke situs luar (data situs, logo, crawler) lewat `UrlGuard`: hanya http/https port 80/443, IP privat/reserved ditolak, koneksi dikunci ke IP yang sudah diperiksa (anti DNS rebinding), redirect diperiksa ulang.
- Logo: diunduh dari situs, jenis dicek dari isi berkas (PNG/JPG/WEBP/GIF/ICO, tanpa SVG), maks. 512 KB, nama berkas dibuat sistem, database hanya menyimpan path. Bila tidak ada ikon yang layak, domain disimpan tanpa logo.
- Sorotan hasil pencarian memakai penanda khusus, bukan HTML, sehingga frontend tidak memakai `v-html`.

## Pengujian

```
php artisan test
npm test
```

Test backend memakai database `search_engine_test` (dibuat otomatis oleh container PostgreSQL) dan memblokir permintaan HTTP sungguhan.

## Production

Domain: isi `SEARCH_DOMAIN` dan `PANEL_DOMAIN` dengan nama host sebenarnya (tanpa `https://`), arahkan keduanya ke server yang sama, dan isi `SANCTUM_STATEFUL_DOMAINS` dengan domain panel.

Logo (DigitalOcean Spaces): ganti nilai `AWS_*` di `.env`: `AWS_ENDPOINT=https://<region>.digitaloceanspaces.com`, `AWS_URL=https://<bucket>.<region>.digitaloceanspaces.com`, `AWS_DEFAULT_REGION=<region>`, `AWS_USE_PATH_STYLE_ENDPOINT=false`.

Login: `APP_ENV=production`, `TRUSTED_PROXIES` sesuai proxy di depan aplikasi, `ACCOUNTCENTER_DRIVER=http`, isi `ACCOUNTCENTER_URI`/`_NAME`/`_SECRET` dan `ACCOUNTCENTER_SUPERADMIN_EMAILS`, kosongkan `ACCOUNTCENTER_DUMMY_PASSWORD`. Setelah masa uji, nyalakan 2FA di menu **Keamanan**.

Keamanan production (wajib):

- `APP_ENV=production`, `APP_DEBUG=false` (pesan galat teknis tidak pernah tampil ke pengunjung).
- `SESSION_SECURE_COOKIE=true` setelah HTTPS terpasang, supaya cookie sesi panel tidak pernah terkirim lewat http.
- `TRUSTED_PROXIES` diisi alamat proxy yang sebenarnya, **jangan `*`**: dengan `*` siapa pun bisa memalsukan IP lewat header `X-Forwarded-For` dan melewati whitelist IP.
- `ACCOUNTCENTER_DUMMY_PASSWORD` dikosongkan.
- Login 2FA: 5 kode salah mengunci 2FA akun itu selama 15 menit (dihitung per akun, bukan per percobaan login).
