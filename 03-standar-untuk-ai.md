# Standar Pengembangan — Wajib Dipatuhi

Berkas ini disalin ke folder utama setiap repository perusahaan. Sertakan isinya setiap kali meminta AI menulis atau mengubah kode pada proyek ini.

Kode yang melanggar berkas ini akan ditolak saat pemeriksaan, sekalipun berjalan dengan benar.

---

## Aturan menjawab

Sebelum apa pun, tiga hal ini berlaku untuk seluruh jawaban:

1. **Jangan mengarang.** Bila nama tabel, nama kolom, atau aturan bisnis tidak disebutkan dalam permintaan, **tanyakan** — jangan diisi dengan tebakan yang masuk akal. Struktur data yang dikarang akan terlihat benar dan baru ketahuan salah setelah dipakai.
2. **Jangan mengerjakan yang tidak diminta.** Jangan menambah fitur, penanganan keadaan, atau "perbaikan" di luar yang diminta. Setiap baris yang tidak diminta adalah baris yang tidak pernah disetujui siapa pun.
3. **Sebutkan bila tidak yakin.** Terutama pada nomor versi library, nama paket, dan cara pemakaian yang mungkin sudah berubah.

---

## Teknologi — tidak boleh diganti tanpa persetujuan

| Bagian | Yang dipakai |
|---|---|
| Backend PHP | Laravel |
| Backend JavaScript | Node.js + AdonisJS |
| Frontend | Vue atau React — satu aplikasi hanya satu, tidak dicampur |
| CSS | Tailwind |
| Permintaan HTTP | Axios — bukan `fetch` mentah |
| Basis data | **PostgreSQL** |
| Build tool | Vite |
| Cache | Redis |
| Penyimpanan berkas | **DigitalOcean Spaces** |
| Pengujian | Pest (backend), Vitest (frontend) |

## Library resmi — jangan pakai yang lain untuk keperluan yang sama

**Frontend**

| Keperluan | Library |
|---|---|
| Ikon | Lucide |
| Tanggal dan waktu | Day.js — **bukan Moment.js** |
| Dialog, toast, tooltip, select, combobox | Reka UI (Vue) / Radix UI (React), tampilan ditulis sendiri dengan Tailwind |
| Tabel data | TanStack Table |
| Grafik | ApexCharts |
| Form dan validasi | VeeValidate (Vue) / React Hook Form (React) |
| Penyimpanan state | Pinia (Vue) / Zustand (React) |
| Ekspor Excel | SheetJS |

**Backend Laravel**

| Keperluan | Library |
|---|---|
| Autentikasi API | Laravel Sanctum |
| Hak akses dan peran | Spatie Laravel Permission — jangan buat sistem peran sendiri |
| Impor dan ekspor Excel | Maatwebsite Laravel Excel |
| Cetak PDF | Barryvdh DomPDF |
| Jejak perubahan data | Spatie Activity Log |

**Dilarang keras:**

- **SweetAlert2** — ditolak perusahaan. Pakai Dialog dari Reka/Radix.
- **vue-sonner** — dihapus. Toast memakai primitive Toast dari Reka/Radix.
- **Chart.js** atau library grafik lain — grafik resminya ApexCharts.
- Menambah library apa pun di luar daftar ini tanpa disebutkan dalam permintaan. Bila sebuah keperluan belum ada library resminya, **katakan dan tunggu keputusan** — jangan pilih sendiri.

---

## Penulisan kode

- **Indentasi 4 spasi untuk semua bahasa** — PHP, JavaScript, Vue, React, dan berkas konfigurasi. Tidak memakai tab, dan tidak memakai 2 spasi walaupun itu kebiasaan umum di JavaScript.
- Nama teknis — variabel, fungsi, kelas, tabel, kolom, endpoint — **bahasa Inggris**.
- Teks yang dilihat pengguna — **bahasa Indonesia**.
- Komentar menjelaskan **kenapa**, bukan **apa**. Jangan menulis komentar yang hanya mengulang isi barisnya.
- Satu fungsi mengerjakan satu hal.
- Hindari nama yang terlalu umum: `data`, `item`, `temp`, `result`, `handle`.

**Penamaan**

| Jenis | Aturan | Contoh |
|---|---|---|
| Kelas | PascalCase | `PurchaseOrder` |
| Fungsi dan variabel | camelCase | `getActiveUsers` |
| Konstanta | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE` |
| Tabel | snake_case, jamak | `purchase_orders` |
| Kolom | snake_case | `created_at` |
| Model Laravel | PascalCase, tunggal | `PurchaseOrder` |
| Controller | PascalCase + `Controller` | `PurchaseOrderController` |
| Komponen Vue / React | PascalCase, nama berkas sama | `UserCard.vue` |
| Nilai benar/salah | diawali `is`, `has`, `can` | `isActive` |

**Dilarang:** meninggalkan kode mati, kode yang dikomentari, `console.log`, `dd()`, atau `var_dump()`.

---

## Basis data

- Nama tabel snake_case bentuk jamak. Nama kolom tidak mengulang nama tabel — di tabel `users` cukup `name`, bukan `user_name`.
- Kunci utama bernama `id`. Kunci asing memakai bentuk tunggal nama tabel + `_id`.
- Setiap tabel wajib punya `id`, `created_at`, `updated_at`.
- Data yang tidak boleh benar-benar hilang memakai penghapusan lunak lewat `deleted_at`.
- Data penting mencatat `created_by` dan `updated_by`.
- Perubahan struktur **hanya lewat migration**. Migration yang sudah dijalankan di production tidak boleh diubah isinya — buat migration baru.
- Kolom yang sering dicari dan **seluruh kunci asing wajib diberi indeks**.
- Password wajib disimpan dalam bentuk hash.

---

## API

Seluruh API memakai bentuk jawaban yang sama:

```json
// berhasil
{ "success": true, "message": "Data berhasil diambil", "data": {} }

// gagal
{ "success": false, "message": "Data tidak ditemukan", "errors": {} }
```

| Kode | Dipakai saat |
|---|---|
| 200 | Permintaan berhasil |
| 201 | Data baru berhasil dibuat |
| 400 | Bentuk permintaan tidak sesuai |
| 401 | Belum masuk atau token tidak berlaku |
| 403 | Sudah masuk, tetapi tidak berhak |
| 404 | Data tidak ditemukan |
| 422 | Isian tidak lolos validasi |
| 500 | Kesalahan pada sisi server |

- Alamat memakai kata benda jamak, huruf kecil, dipisah tanda hubung, selalu bernomor versi: `/api/v1/purchase-orders`.
- Kegiatan ditentukan oleh method, bukan oleh nama alamat.
- Daftar data yang panjang **wajib** memakai pagination dengan `page` dan `per_page`.
- Tanggal dan waktu memakai format ISO 8601.

---

## Keamanan — bagian yang paling sering dilanggar

- **Validasi wajib di server.** Validasi di frontend hanya untuk kenyamanan pengguna dan tidak boleh menjadi satu-satunya pengaman.
- **Hak akses diperiksa di server pada setiap endpoint.** Menyembunyikan tombol di tampilan bukan pengamanan.
- Query wajib memakai query builder, ORM, atau prepared statement. **Dilarang menyambung perintah SQL dari masukan pengguna.**
- Teks dari pengguna yang ditampilkan kembali wajib diamankan agar tidak bisa disisipi skrip.
- **Dilarang menuliskan kredensial di dalam kode**, sekalipun untuk sementara. Kredensial hanya di `.env`.
- Catatan sistem tidak boleh memuat password, token, atau data pribadi.
- Penanganan kesalahan **tidak boleh kosong**. Jangan menulis `try { } catch { }` yang menelan kegagalan tanpa jejak.

## Berkas unggahan

- Berkas penting **wajib** disimpan di DigitalOcean Spaces melalui driver yang sesuai standar S3.
- **Dilarang** menyimpan berkas penting di penyimpanan lokal server, termasuk folder `storage` bawaan Laravel.
- Basis data hanya menyimpan jalur berkas, bukan alamat lengkap yang mengandung nama server.
- Berkas rahasia tidak boleh dapat diakses umum — aksesnya lewat tautan bertanda waktu yang punya masa berlaku.
- Jenis dan ukuran berkas dibatasi, diperiksa **di sisi server**.
- Nama berkas diganti oleh sistem, tidak memakai nama asli dari pengguna.

---

## Antrean — aturan yang paling mudah salah

**Pekerjaan yang mengubah data, saldo, stok, atau status persetujuan DILARANG memakai antrean Redis.**

Pekerjaan semacam itu wajib memakai antrean berbasis PostgreSQL, agar pencatatan pekerjaan ke antrean berada dalam transaksi yang sama dengan perubahan datanya. Bila transaksinya gagal, pekerjaannya ikut dibatalkan.

Redis hanya boleh untuk antrean **non-transaksional**: pengiriman email, notifikasi, pembuatan laporan, pengolahan gambar.

Perubahan data yang saling terkait wajib berada dalam **satu transaksi**. Tidak boleh ada keadaan di mana sebagian tersimpan dan sebagian gagal.

---

## Git

- Dilarang mengirim kode langsung ke `main`.
- Format pesan commit: `jenis: ringkasan singkat`. Jenis yang dipakai: `feat`, `fix`, `refactor`, `docs`, `chore`.
- Satu commit berisi satu perubahan yang bermakna.
- `.gitignore` wajib memuat `.env`, `vendor`, `node_modules`, dan hasil build.

---

## Antarmuka

- Tailwind adalah satu-satunya cara menulis gaya tampilan. **Dilarang menulis gaya langsung di dalam tag HTML.**
- Warna, ukuran huruf, dan jarak mengikuti pengaturan Tailwind bersama. Dilarang memakai nilai acak di luar pengaturan tersebut.
- Bagian yang berulang dibuat sekali sebagai komponen bersama. Dilarang menyalin komponen yang sudah ada untuk diubah sedikit.
- Setiap tindakan pengguna diberi tanggapan yang jelas: sedang diproses, berhasil, atau gagal.
- Pesan kesalahan menjelaskan apa yang harus dilakukan pengguna, bukan menampilkan pesan teknis mentah.
- Tindakan menghapus wajib disertai konfirmasi.
- Tampilan wajib bisa dipakai minimal di layar laptop dan ponsel.

---

## Sebelum menyatakan selesai

Periksa sendiri daftar ini sebelum menyerahkan kode:

- [ ] Tidak ada `console.log`, `dd()`, `var_dump()`, atau kode yang dikomentari
- [ ] Indentasi 4 spasi di seluruh berkas yang disentuh
- [ ] Validasi ada di sisi server, bukan hanya di tampilan
- [ ] Hak akses diperiksa di server pada setiap endpoint yang dibuat
- [ ] Tidak ada kredensial di dalam kode
- [ ] Tidak ada library baru yang ditambahkan tanpa diminta
- [ ] Tidak ada tabel atau kolom yang dibuat tanpa disebutkan dalam permintaan
- [ ] Penanganan kesalahan tidak ada yang kosong
- [ ] Bila menyentuh data penting: perubahannya berada dalam satu transaksi
- [ ] Bila membuat antrean: sudah dipastikan transaksional atau tidak, dan memakai yang sesuai
