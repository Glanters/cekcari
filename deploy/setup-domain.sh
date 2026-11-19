#!/usr/bin/env bash
#
# Menghubungkan CekCari ke dua domainnya — Nginx dan sertifikat sekaligus.
#
#   sudo ./deploy/setup-domain.sh                 # jalur dipilih sendiri (Cloudflare / Let's Encrypt)
#   sudo ./deploy/setup-domain.sh --cloudflare
#   sudo ./deploy/setup-domain.sh --letsencrypt
#
# Domain dan port dibaca dari .env (SEARCH_DOMAIN, PANEL_DOMAIN, PORT), jadi tidak bisa berbeda
# dari yang dipakai aplikasi. Bila www.<SEARCH_DOMAIN> punya DNS (mis. www.cekcari.com), alamat itu
# ikut masuk sertifikat dan dialihkan 301 ke SEARCH_DOMAIN, supaya Google hanya melihat satu alamat.
# Ganti domain (mis. dari server uji ke cekcari.com) cukup ubah .env lalu jalankan ulang skrip ini:
# sertifikat yang belum memuat semua domain diterbitkan ulang.
#
# ## Dua jalur sertifikat (sama seperti hrms)
#
#   CLOUDFLARE     — domain diproksi (awan jingga). Let's Encrypt HTTP-01 tidak bisa lewat edge
#                    Cloudflare, jadi dipakai Origin Certificate Cloudflare: berlaku 15 tahun,
#                    tanpa perpanjangan yang bisa gagal diam-diam.
#   LET'S ENCRYPT  — domain menunjuk langsung ke server ini. Diterbitkan lewat --webroot.
#
# ## Nginx TIDAK pernah dimatikan
#
# Server ini melayani situs lain. Tantangan ACME dilayani blok port 80 sementara, lalu nginx
# hanya di-reload — tidak ada situs yang ikut mati.
#
# ## Yang TIDAK dikerjakannya
#
# Tidak menyentuh basis data, migrasi, PM2, atau .env. Aplikasi harus sudah berjalan lebih dulu
# (lihat DEPLOY.md); skrip berhenti bila port di .env tidak dijawab oleh CekCari.

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLAT="$AKAR/deploy/nginx/cekcari.conf"
ENV_FILE="$AKAR/.env"
WEBROOT_ACME="/var/www/certbot"
DIR_ORIGIN="/etc/ssl/cloudflare"
NAMA_SITUS="cekcari"
SITE_TERSEDIA="/etc/nginx/sites-available/$NAMA_SITUS"
SITE_AKTIF="/etc/nginx/sites-enabled/$NAMA_SITUS"

merah() { printf '\033[31m%s\033[0m\n' "$*"; }
kuning() { printf '\033[33m%s\033[0m\n' "$*"; }
hijau() { printf '\033[32m%s\033[0m\n' "$*"; }
info() { printf '\033[36m→\033[0m %s\n' "$*"; }

gagal() {
    merah "GAGAL: $*"
    exit 1
}

nilai_env() {
    grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"'"'" | tr -d '\r'
}

# ------------------------------------------------------------------- argumen

MODE="auto"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cloudflare) MODE="cloudflare" ;;
        --letsencrypt) MODE="letsencrypt" ;;
        *) gagal "Argumen tidak dikenal: $1" ;;
    esac
    shift
done

[[ $EUID -eq 0 ]] || gagal "Jalankan dengan sudo — skrip ini menulis ke /etc/nginx."

for perintah in nginx curl dig openssl; do
    command -v "$perintah" >/dev/null 2>&1 || gagal \
        "\`$perintah\` tidak ada. Pasang lebih dulu:
  sudo apt install nginx curl dnsutils openssl"
done

[[ -f "$TEMPLAT" ]] || gagal "Templat tidak ditemukan: $TEMPLAT"
[[ -f "$ENV_FILE" ]] || gagal ".env tidak ditemukan di $AKAR. Ikuti DEPLOY.md langkah 3 lebih dulu."

SEARCH_DOMAIN="$(nilai_env SEARCH_DOMAIN)"
PANEL_DOMAIN="$(nilai_env PANEL_DOMAIN)"
APP_PORT="$(nilai_env PORT)"

[[ -n "$SEARCH_DOMAIN" && -n "$PANEL_DOMAIN" && -n "$APP_PORT" ]] ||
    gagal "SEARCH_DOMAIN, PANEL_DOMAIN, dan PORT wajib diisi di $ENV_FILE."
[[ "$SEARCH_DOMAIN" != *localhost* && "$PANEL_DOMAIN" != *localhost* ]] ||
    gagal "Domain di .env masih nilai pengembangan (localhost). Isi domain server yang sebenarnya."

DOMAINS=("$SEARCH_DOMAIN" "$PANEL_DOMAIN")

# www hanya dipakai sebagai pengalihan ke domain pencarian, dan hanya bila DNS-nya memang ada.
WWW_DOMAIN=""
if [[ "$SEARCH_DOMAIN" != www.* && -n "$(dig +short "www.$SEARCH_DOMAIN" A | tail -n1)" ]]; then
    WWW_DOMAIN="www.$SEARCH_DOMAIN"
    DOMAINS+=("$WWW_DOMAIN")
fi

# ------------------------------------------------------ aplikasi sudah berjalan?

# Pelajaran dari pemasangan pertama: port yang dipakai aplikasi lain membuat domain CekCari
# menampilkan aplikasi lain. Nginx hanya dipasang bila port ini benar-benar dijawab CekCari.
info "Memeriksa CekCari di 127.0.0.1:$APP_PORT …"
JAWABAN="$(curl -fsS --max-time 10 -H "Host: $SEARCH_DOMAIN" "http://127.0.0.1:$APP_PORT/up" 2>/dev/null || true)"

if [[ "$JAWABAN" != *'"status":"ok"'* ]]; then
    merah "Port $APP_PORT tidak dijawab CekCari (jawaban: ${JAWABAN:-tidak ada})."
    cat <<PETUNJUK

Periksa:
  pm2 status
  pm2 logs cekcari-web --lines 30 --nostream     # EADDRINUSE = port dipakai aplikasi lain
  sudo ss -ltnp | grep ':$APP_PORT '              # proses yang memegang port ini

Bila port dipakai aplikasi lain, ganti PORT di .env ke port kosong, lalu:
  pm2 restart $AKAR/ecosystem.config.cjs
PETUNJUK
    exit 1
fi

hijau "CekCari menjawab di port $APP_PORT."

# ----------------------------------------------------------------------- DNS

for domain in "${DOMAINS[@]}"; do
    [[ -n "$(dig +short "$domain" A | tail -n1)" ]] ||
        gagal "$domain belum menunjuk ke mana pun. Buat A record ke IP server ini lebih dulu."
done

# Di belakang Cloudflare (awan jingga) atau tidak — terlepas dari jenis sertifikatnya, karena
# pemulihan IP pengunjung tetap diperlukan bila lalu lintas lewat Cloudflare.
BEHIND_CLOUDFLARE=false
if curl -sS -I --max-time 10 "http://$SEARCH_DOMAIN" 2>/dev/null | grep -qi '^server:.*cloudflare'; then
    BEHIND_CLOUDFLARE=true
    info "Cloudflare terdeteksi di depan $SEARCH_DOMAIN."
fi

if [[ "$MODE" == "auto" ]]; then
    [[ "$BEHIND_CLOUDFLARE" == "true" ]] && MODE="cloudflare" || MODE="letsencrypt"
fi

if [[ "$BEHIND_CLOUDFLARE" == "true" ]]; then
    # Hostname yang masih terdaftar di Cloudflare Tunnel tidak pernah sampai ke nginx ini.
    kuning "Pastikan $SEARCH_DOMAIN dan $PANEL_DOMAIN TIDAK lagi ada di Public Hostname Cloudflare Tunnel,"
    kuning "dan DNS-nya berupa A record ke IP server ini. Selama masih di tunnel, domain tetap"
    kuning "diarahkan ke layanan yang tercatat di tunnel itu (aplikasi lain), bukan ke nginx ini."
else
    IP_SERVER="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"
    for domain in "${DOMAINS[@]}"; do
        IP_DOMAIN="$(dig +short "$domain" A | tail -n1)"
        if [[ -n "$IP_SERVER" && "$IP_DOMAIN" != "$IP_SERVER" ]]; then
            kuning "PERINGATAN: $domain menunjuk $IP_DOMAIN, sedangkan IP server ini $IP_SERVER."
        fi
    done
fi

# ------------------------------------------------------------------ sertifikat

mkdir -p "$WEBROOT_ACME"

if [[ "$MODE" == "cloudflare" ]]; then
    JALUR_CERT="$DIR_ORIGIN/$NAMA_SITUS.pem"
    JALUR_KEY="$DIR_ORIGIN/$NAMA_SITUS.key"

    if [[ ! -f "$JALUR_CERT" || ! -f "$JALUR_KEY" ]]; then
        merah "Origin Certificate untuk CekCari belum ada di server ini."
        cat <<PETUNJUK

Terbitkan sekali, berlaku 15 tahun, tanpa perpanjangan:

  1. Dasbor Cloudflare → domain Anda → SSL/TLS → Origin Server → Create Certificate
     Hostnames: ${DOMAINS[*]}
     Biarkan RSA 2048 dan masa berlaku 15 tahun.

  2. Salin kedua blok teksnya ke server ini:

       sudo mkdir -p $DIR_ORIGIN && sudo chmod 700 $DIR_ORIGIN
       sudo nano $JALUR_CERT     # blok "Origin Certificate"
       sudo nano $JALUR_KEY      # blok "Private Key"
       sudo chmod 600 $JALUR_KEY

  3. Jalankan ulang perintah ini.

Pastikan SSL/TLS → Overview berada pada "Full (strict)". "Flexible" membuat cookie login
panel (ber-flag Secure) tidak pernah sampai — gejalanya login yang selalu terlempar keluar.

PETUNJUK
        exit 1
    fi

    # Origin Certificate diterbitkan per hostname; sertifikat milik domain lain menghasilkan 526.
    for domain in "${DOMAINS[@]}"; do
        openssl x509 -in "$JALUR_CERT" -noout -checkhost "$domain" 2>/dev/null | grep -q 'does match' ||
            gagal "$JALUR_CERT tidak memuat $domain. Terbitkan ulang dengan hostname: ${DOMAINS[*]}"
    done

    hijau "Origin Certificate ditemukan dan memuat semua domain."
else
    JALUR_CERT="/etc/letsencrypt/live/$NAMA_SITUS/fullchain.pem"
    JALUR_KEY="/etc/letsencrypt/live/$NAMA_SITUS/privkey.pem"

    command -v certbot >/dev/null 2>&1 || gagal "\`certbot\` tidak ada. Pasang lebih dulu:  sudo apt install certbot"

    # Sertifikat yang sudah memuat semua domain tidak diminta ulang: jatah Let's Encrypt
    # 5 penerbitan per pekan. Setelah domain di .env diganti, sertifikat lama tidak memuatnya lagi.
    SERTIFIKAT_LENGKAP=false
    if [[ -f "$JALUR_CERT" ]]; then
        SERTIFIKAT_LENGKAP=true
        for domain in "${DOMAINS[@]}"; do
            openssl x509 -in "$JALUR_CERT" -noout -checkhost "$domain" 2>/dev/null | grep -q 'does match' ||
                SERTIFIKAT_LENGKAP=false
        done
    fi

    if [[ "$SERTIFIKAT_LENGKAP" == "true" ]]; then
        info "Sertifikat CekCari sudah memuat semua domain — tidak diminta ulang."
    else
        info "Menerbitkan sertifikat untuk ${DOMAINS[*]} …"
        SEMENTARA="/etc/nginx/sites-available/$NAMA_SITUS.acme"

        cat >"$SEMENTARA" <<KONFIG
# Sementara — hanya melayani tantangan ACME sampai sertifikat terbit (deploy/setup-domain.sh).
server {
    listen 80;
    server_name ${DOMAINS[*]};

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT_ACME;
    }

    location / {
        return 404;
    }
}
KONFIG

        ln -sfn "$SEMENTARA" "/etc/nginx/sites-enabled/$NAMA_SITUS.acme"
        nginx -t || gagal "Konfigurasi sementara ditolak Nginx."
        systemctl reload nginx

        DOMAIN_ARGS=()
        for domain in "${DOMAINS[@]}"; do
            DOMAIN_ARGS+=(-d "$domain")
        done

        # --cert-name yang sama mengganti daftar domain sertifikat lama (mis. domain server uji).
        if ! certbot certonly --webroot -w "$WEBROOT_ACME" --non-interactive --agree-tos \
            --register-unsafely-without-email --cert-name "$NAMA_SITUS" \
            --deploy-hook "systemctl reload nginx" \
            "${DOMAIN_ARGS[@]}"; then
            rm -f "/etc/nginx/sites-enabled/$NAMA_SITUS.acme" "$SEMENTARA"
            systemctl reload nginx || true
            merah "Penerbitan sertifikat gagal. Detail: /var/log/letsencrypt/letsencrypt.log"
            cat <<PETUNJUK

Penyebab yang paling sering:
  - Domain masih di Public Hostname Cloudflare Tunnel → hapus dari tunnel.
  - DNS belum berupa A record ke IP server ini → buat A record untuk ${DOMAINS[*]}.
  - Domain diproksi Cloudflare (awan jingga) dengan "Always Use HTTPS" → ubah kedua record ke
    "DNS only" (awan abu-abu), jalankan ulang, lalu boleh dikembalikan ke Proxied dengan
    SSL/TLS "Full (strict)".
PETUNJUK
            exit 1
        fi

        rm -f "/etc/nginx/sites-enabled/$NAMA_SITUS.acme" "$SEMENTARA"
        hijau "Sertifikat terbit."
    fi
fi

# --------------------------------------------------------------------- nginx

# Situs lain yang sudah memakai salah satu domain ini akan berebut server_name dengan CekCari.
for domain in "${DOMAINS[@]}"; do
    BENTROK="$(grep -lE "server_name[^;]*[[:space:]]$domain[[:space:];]" /etc/nginx/sites-enabled/* 2>/dev/null |
        grep -v "/$NAMA_SITUS$" || true)"
    [[ -z "$BENTROK" ]] || gagal "$domain sudah dipakai situs nginx lain: $BENTROK"
done

if [[ -f "$SITE_TERSEDIA" ]]; then
    CADANGAN="$SITE_TERSEDIA.bak.$(date +%Y%m%d%H%M%S)"
    cp "$SITE_TERSEDIA" "$CADANGAN"
    info "Konfigurasi lama dicadangkan ke $CADANGAN"
fi

info "Memasang konfigurasi Nginx …"

sed -e "s|__SEARCH_DOMAIN__|$SEARCH_DOMAIN|g" \
    -e "s|__PANEL_DOMAIN__|$PANEL_DOMAIN|g" \
    -e "s|__APP_PORT__|$APP_PORT|g" \
    -e "s|__SSL_CERTIFICATE__|$JALUR_CERT|g" \
    -e "s|__SSL_CERTIFICATE_KEY__|$JALUR_KEY|g" \
    "$TEMPLAT" >"$SITE_TERSEDIA"

if [[ -n "$WWW_DOMAIN" ]]; then
    cat >>"$SITE_TERSEDIA" <<KONFIG

# www dialihkan permanen ke domain pencarian (satu alamat untuk Google). Ditambahkan setup-domain.sh.
server {
    listen 80;
    listen 443 ssl http2;
    server_name $WWW_DOMAIN;

    ssl_certificate     $JALUR_CERT;
    ssl_certificate_key $JALUR_KEY;

    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT_ACME;
    }

    location / {
        return 301 https://$SEARCH_DOMAIN\$request_uri;
    }
}
KONFIG
    info "$WWW_DOMAIN dialihkan ke https://$SEARCH_DOMAIN."
fi

if [[ "$BEHIND_CLOUDFLARE" == "true" ]]; then
    if [[ ! -f /etc/nginx/cloudflare-realip.conf ]]; then
        info "Menyusun daftar rentang Cloudflare …"
        "$AKAR/deploy/cloudflare-realip.sh" || gagal "Daftar rentang Cloudflare gagal disusun."
    fi

    sed -i "s|^\( *\)#     include /etc/nginx/cloudflare-realip.conf;|\1include /etc/nginx/cloudflare-realip.conf;|" \
        "$SITE_TERSEDIA"
    grep -q "^ *include /etc/nginx/cloudflare-realip.conf;" "$SITE_TERSEDIA" ||
        gagal "Baris include cloudflare-realip.conf tidak ditemukan pada templat."

    hijau "Pemulihan alamat pengunjung Cloudflare diaktifkan."
fi

ln -sfn "$SITE_TERSEDIA" "$SITE_AKTIF"

if ! nginx -t; then
    rm -f "$SITE_AKTIF"
    gagal "Konfigurasi Nginx ditolak; situs CekCari dinonaktifkan lagi agar situs lain tetap jalan."
fi

systemctl reload nginx 2>/dev/null || systemctl start nginx

# ------------------------------------------------------------------- periksa

for domain in "$SEARCH_DOMAIN" "$PANEL_DOMAIN"; do
    HASIL="$(curl -sk --max-time 10 --resolve "$domain:443:127.0.0.1" "https://$domain/up" || true)"
    [[ "$HASIL" == *'"status":"ok"'* ]] || gagal "nginx tidak meneruskan $domain ke CekCari (jawaban: ${HASIL:-tidak ada})."
done

hijau "Nginx aktif untuk $SEARCH_DOMAIN dan $PANEL_DOMAIN."
echo
echo "Buka https://$SEARCH_DOMAIN dan https://$PANEL_DOMAIN/masuk."
