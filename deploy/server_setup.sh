#!/usr/bin/env bash
#
# Sekali jalan di server (seperti revenue): .env lengkap, database, build, migrasi, PM2,
# Nginx + sertifikat Let's Encrypt, lalu cek. Aman diulang: nilai .env yang sudah ada
# (APP_KEY, password, email) dipertahankan, port yang dipakai program lain dilewati.
#
#   cd /opt/cekcari && git pull && bash deploy/server_setup.sh
#
# Domain bawaan: cari.salahmu.fun (pencarian) dan panel-cari.salahmu.fun (panel). Domain lain:
#   SEARCH_DOMAIN=cekcari.com PANEL_DOMAIN=panel.cekcari.com bash deploy/server_setup.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"
ENV_FILE="$ROOT_DIR/.env"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mGAGAL: %s\033[0m\n' "$*"; exit 1; }

for tool in node npm pm2 openssl ss curl psql nginx certbot dig; do
    command -v "$tool" >/dev/null 2>&1 || fail "perintah '$tool' belum terpasang. Pasang dulu:
  sudo apt install -y git postgresql redis-server chrony nginx certbot dnsutils
  (Node 24 dan PM2: lihat DEPLOY.md langkah 1)"
done

# Nilai dari .env sekarang, atau kosong. Placeholder <...> dan nilai pengembangan (localhost) dianggap kosong.
current() {
    [ -f "$ENV_FILE" ] || return 0
    local value
    value="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' || true)"
    case "$value" in
        \<*|*localhost*|GANTI_*) value="" ;;
    esac
    echo "$value"
}

# Port TCP kosong pertama mulai dari $1.
free_port() {
    local port="$1"
    while ss -ltn "sport = :$port" | grep -q LISTEN; do
        port=$((port + 1))
    done
    echo "$port"
}

random_hex() { openssl rand -hex "$1"; }

say "1/8 Menyiapkan .env"
# Proses CekCari sendiri dihentikan dulu supaya portnya terhitung kosong.
pm2 stop cekcari-web cekcari-queue >/dev/null 2>&1 || true

APP_KEY="$(current APP_KEY)"
[ "${#APP_KEY}" -ge 32 ] || APP_KEY="$(openssl rand -base64 32 | tr -d '\n')"

PORT="$(current PORT)"
if [ -z "$PORT" ] || [ "$PORT" = "3333" ] || ss -ltn "sport = :$PORT" | grep -q LISTEN; then
    PORT="$(free_port 3345)"
fi

SEARCH_DOMAIN="${SEARCH_DOMAIN:-$(current SEARCH_DOMAIN)}"; SEARCH_DOMAIN="${SEARCH_DOMAIN:-cari.salahmu.fun}"
PANEL_DOMAIN="${PANEL_DOMAIN:-$(current PANEL_DOMAIN)}"; PANEL_DOMAIN="${PANEL_DOMAIN:-panel-cari.salahmu.fun}"

# Hanya cekcari.com yang boleh diindeks Google; domain uji selalu ditutup.
SEO_ALLOW_INDEXING=false
[ "$SEARCH_DOMAIN" = "cekcari.com" ] && SEO_ALLOW_INDEXING=true

DB_USER="$(current DB_USER)"; DB_USER="${DB_USER:-cekcari}"
DB_DATABASE="$(current DB_DATABASE)"; DB_DATABASE="${DB_DATABASE:-cekcari}"
DB_PASSWORD="$(current DB_PASSWORD)"; DB_PASSWORD="${DB_PASSWORD:-$(random_hex 16)}"
DB_PORT="$(current DB_PORT)"
[ -n "$DB_PORT" ] && [ "$DB_PORT" != "5480" ] || DB_PORT=5432

SUPERADMIN_EMAILS="$(current ACCOUNTCENTER_SUPERADMIN_EMAILS)"
if [ -z "$SUPERADMIN_EMAILS" ] || [ "$SUPERADMIN_EMAILS" = "pemilik.uji@example.com" ]; then
    read -rp "Email untuk login sebagai superadmin: " SUPERADMIN_EMAILS
    [ -n "$SUPERADMIN_EMAILS" ] || fail "email superadmin wajib diisi."
fi

DUMMY_PASSWORD="$(current ACCOUNTCENTER_DUMMY_PASSWORD)"
[ "${#DUMMY_PASSWORD}" -ge 16 ] || DUMMY_PASSWORD="$(random_hex 12)"
GOOGLE_SITE_VERIFICATION="$(current GOOGLE_SITE_VERIFICATION)"

# Account Center asli yang sudah diisi di .env dipertahankan; tanpa itu dipakai login dummy.
AC_URI="$(current ACCOUNTCENTER_URI)"
AC_NAME="$(current ACCOUNTCENTER_NAME)"
AC_SECRET="$(current ACCOUNTCENTER_SECRET)"
if [ "$(current ACCOUNTCENTER_DRIVER)" = "http" ] && [ -n "$AC_URI" ] && [ -n "$AC_NAME" ] && [ -n "$AC_SECRET" ]; then
    LOGIN_BLOCK="# Login lewat Account Center asli.
ACCOUNTCENTER_DRIVER=http
ACCOUNTCENTER_URI=$AC_URI
ACCOUNTCENTER_NAME=$AC_NAME
ACCOUNTCENTER_SECRET=$AC_SECRET
ACCOUNTCENTER_TIMEOUT_MS=8000"
    LOGIN_INFO="password Account Center Anda"
else
    LOGIN_BLOCK="# Login sementara (dummy) sampai Account Center asli tersedia.
ACCOUNTCENTER_DRIVER=dummy
ACCOUNTCENTER_DUMMY_IN_PRODUCTION=true
ACCOUNTCENTER_DUMMY_PASSWORD=$DUMMY_PASSWORD"
    LOGIN_INFO="password $DUMMY_PASSWORD"
fi

if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
fi
umask 077
cat > "$ENV_FILE" <<EOF
TZ=UTC
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
LOG_LEVEL=info
APP_NAME=CekCari
APP_KEY=$APP_KEY

SEARCH_DOMAIN=$SEARCH_DOMAIN
PANEL_DOMAIN=$PANEL_DOMAIN
SEARCH_URL=https://$SEARCH_DOMAIN
GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
SEO_ALLOW_INDEXING=$SEO_ALLOW_INDEXING

SESSION_DRIVER=redis
LIMITER_STORE=redis

DB_HOST=127.0.0.1
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_DATABASE=$DB_DATABASE

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_KEY_PREFIX=cekcari:

CRAWLER_MAX_PAGES=50
CRAWLER_USER_AGENT="CekCariBot/1.0"
CRAWLER_DELAY_MS=500

# Nginx di server yang sama: hanya localhost yang dipercaya sebagai proxy.
TRUSTED_PROXIES=127.0.0.1,::1

$LOGIN_BLOCK
ACCOUNTCENTER_SUPERADMIN_EMAILS=$SUPERADMIN_EMAILS
EOF
umask 022
echo "   .env ditulis (port $PORT, domain $SEARCH_DOMAIN dan $PANEL_DOMAIN)."

say "2/8 Database PostgreSQL ($DB_DATABASE, user $DB_USER)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER ROLE "$DB_USER" WITH LOGIN PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_DATABASE'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" "$DB_DATABASE"
fi
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT 1" >/dev/null \
    || fail "tidak bisa masuk ke database dengan user $DB_USER."
redis-cli ping >/dev/null 2>&1 || fail "Redis tidak menjawab. Nyalakan: sudo systemctl enable --now redis-server"

say "3/8 Memasang paket"
npm ci --no-audit --no-fund

say "4/8 Build"
node ace build

say "5/8 Paket produksi"
(cd build && npm ci --omit=dev --no-audit --no-fund)

say "6/8 Migrasi database"
(cd build && ENV_PATH=../ node ace migration:run --force)

say "7/8 Menjalankan dengan PM2"
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save

echo "   Menunggu aplikasi siap..."
STATUS=""
for _ in $(seq 1 20); do
    STATUS="$(curl -s -H "Host: $SEARCH_DOMAIN" "http://127.0.0.1:$PORT/up" || true)"
    [[ "$STATUS" == *'"status":"ok"'* ]] && break
    sleep 1
done
[[ "$STATUS" == *'"status":"ok"'* ]] || { pm2 logs cekcari-web --lines 30 --nostream || true; fail "aplikasi tidak menjawab di port $PORT (log di atas)."; }

say "8/8 Nginx + sertifikat Let's Encrypt"
sudo bash "$ROOT_DIR/deploy/setup-domain.sh" --letsencrypt

cat <<EOF

$(printf '\033[1;32m')SELESAI$(printf '\033[0m')

  Pencarian : https://$SEARCH_DOMAIN
  Panel     : https://$PANEL_DOMAIN/masuk
  Login     : email $SUPERADMIN_EMAILS
              $LOGIN_INFO
              (2FA sedang mati selama masa uji; nyalakan di menu Keamanan bila perlu)

  Simpan password di atas. Semua nilai ada di $ENV_FILE (cadangan lama: .env.bak.*).
  Log: pm2 logs cekcari-web  /  pm2 logs cekcari-queue
EOF
