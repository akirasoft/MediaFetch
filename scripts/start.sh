#!/bin/sh
# ─────────────────────────────────────────────────────────────
# MediaFetch — sunucu başlatıcı (Ubuntu / Pterodactyl / Docker)
#
# Pterodactyl'de "Startup Command" alanına şunu yazmak yeterli:
#     sh scripts/start.sh
#
# Panel SERVER_PORT değişkenini kendisi verir; server.js onu kullanır.
# ─────────────────────────────────────────────────────────────
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

# .env varsa oku (KEY=VALUE satırları; # ile başlayanlar yorum).
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

# İlk çalıştırmada yt-dlp yoksa kurulumu kendi yapsın — panelden ayrıca
# komut çalıştırmak gerekmesin.
if [ ! -x "$ROOT/bin/yt-dlp" ] && ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp yok — kurulum çalıştırılıyor..."
  sh "$ROOT/scripts/install-linux.sh"
fi

if [ ! -d "$ROOT/node_modules/express" ] || [ ! -d "$ROOT/node_modules/archiver" ]; then
  echo "node_modules eksik — npm install çalıştırılıyor..."
  npm install --omit=dev
fi

# Hosted mod: her arayüze bağlan, tarayıcı açma, dosyaları HTTP ile geri ver.
export MEDIAFETCH_MODE="${MEDIAFETCH_MODE:-server}"

# ── Cloudflare Tunnel (opsiyonel) ────────────────────────────
# Tarayıcılar düz HTTP üzerinden gelen dosyaları indirmeyi reddedebiliyor
# (Brave varsayılan olarak siliyor). Tünel, sunucuyu geçerli sertifikalı bir
# https:// adresinin arkasına koyar — sunucuda kök yetkisi ya da açık port
# gerekmeden.
#
#   MEDIAFETCH_TUNNEL=1            -> ücretsiz geçici adres (her açılışta değişir)
#   CLOUDFLARE_TUNNEL_TOKEN=...    -> kendi hesabındaki kalıcı adres
TUNNEL_URL_FILE="$ROOT/.tunnel-url"
rm -f "$TUNNEL_URL_FILE"

start_tunnel() {
  CF="$ROOT/bin/cloudflared"

  if [ ! -x "$CF" ]; then
    case "$(uname -m)" in
      x86_64|amd64)  CF_ARCH=amd64 ;;
      aarch64|arm64) CF_ARCH=arm64 ;;
      *) echo "tünel: desteklenmeyen mimari, atlanıyor"; return 0 ;;
    esac
    echo "==> cloudflared indiriliyor ($CF_ARCH)"
    if command -v curl >/dev/null 2>&1; then
      curl -fL --retry 3 -o "$CF" \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" || {
          echo "tünel: cloudflared indirilemedi, tünelsiz devam ediliyor"; rm -f "$CF"; return 0; }
    else
      echo "tünel: curl yok, atlanıyor"; return 0
    fi
    chmod 755 "$CF"
  fi

  LOG="$ROOT/.tunnel.log"
  : > "$LOG"

  if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    echo "==> Cloudflare tüneli (kalıcı adres) başlatılıyor"
    "$CF" tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN" >>"$LOG" 2>&1 &
    # Adresi Cloudflare panelinde tanımladığın için burada gösterecek bir URL yok.
    return 0
  fi

  echo "==> Cloudflare tüneli (geçici adres) başlatılıyor"
  "$CF" tunnel --no-autoupdate --url "http://127.0.0.1:${SERVER_PORT:-${MEDIAFETCH_PORT:-8422}}" >>"$LOG" 2>&1 &

  # Adres loga birkaç saniye içinde düşüyor; yakalayıp hem konsola bas hem de
  # dosyaya yaz ki arayüz onu gösterebilsin.
  i=0
  while [ "$i" -lt 30 ]; do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -n1 || true)
    if [ -n "$URL" ]; then
      printf '%s' "$URL" > "$TUNNEL_URL_FILE"
      echo ""
      echo "  ╔════════════════════════════════════════════════════════╗"
      echo "  ║  HTTPS adresi hazır:"
      echo "  ║  $URL"
      echo "  ╚════════════════════════════════════════════════════════╝"
      echo ""
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "tünel: adres alınamadı (bkz. .tunnel.log) — düz HTTP ile devam ediliyor"
}

case "${MEDIAFETCH_TUNNEL:-0}" in
  1|true|TRUE|yes|on) start_tunnel ;;
  *) [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ] && start_tunnel || true ;;
esac

exec node server.js
