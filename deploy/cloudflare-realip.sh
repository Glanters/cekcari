#!/usr/bin/env bash
#
# Menyusun daftar rentang IP Cloudflare agar nginx memulihkan alamat pengunjung yang sebenarnya.
#
#   sudo ./deploy/cloudflare-realip.sh
#
# Di belakang Cloudflare, `$remote_addr` berisi alamat Cloudflare. Whitelist IP panel dan
# pembatas laju login CekCari lalu memeriksa alamat yang salah. Header CF-Connecting-IP hanya
# boleh dipercaya bila sambungannya memang dari rentang Cloudflare; `set_real_ip_from`
# memastikan itu, sehingga orang yang menjangkau server langsung tidak bisa memalsukannya.
#
# Rentang Cloudflare sesekali berubah: jalankan ulang tiap beberapa bulan (atau cron bulanan).
# Bila server sudah punya /etc/nginx/cloudflare-realip.conf dari aplikasi lain (mis. hrms),
# berkas yang sama dipakai bersama.

set -euo pipefail

# Di luar conf.d agar tidak termuat dua kali (real_ip_header ganda membuat nginx menolak
# seluruh konfigurasi, termasuk situs lain di server ini).
TUJUAN="/etc/nginx/cloudflare-realip.conf"

[[ $EUID -eq 0 ]] || { echo "Jalankan dengan sudo."; exit 1; }
command -v curl >/dev/null || { echo "curl tidak ada."; exit 1; }

SEMENTARA="$(mktemp)"
trap 'rm -f "$SEMENTARA"' EXIT

{
    echo "# Dibangkitkan deploy/cloudflare-realip.sh pada $(date -Iseconds)"
    echo "# JANGAN disunting tangan — jalankan ulang skripnya."
    echo

    for daftar in ips-v4 ips-v6; do
        curl -fsS --max-time 20 "https://www.cloudflare.com/$daftar" |
            while read -r rentang; do
                [[ -n "$rentang" ]] && echo "set_real_ip_from $rentang;"
            done
    done

    echo
    echo "real_ip_header CF-Connecting-IP;"
} >"$SEMENTARA"

# Berkas yang hampir kosong berarti pengambilan gagal; menimpakannya mematikan pemulihan alamat diam-diam.
if [[ "$(grep -c 'set_real_ip_from' "$SEMENTARA")" -lt 10 ]]; then
    echo "Daftar rentang mencurigakan (terlalu sedikit). Berkas lama dipertahankan."
    exit 1
fi

install -m 0644 "$SEMENTARA" "$TUJUAN"
echo "Ditulis: $TUJUAN  ($(grep -c 'set_real_ip_from' "$TUJUAN") rentang)"
