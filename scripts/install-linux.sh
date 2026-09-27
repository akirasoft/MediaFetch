#!/bin/sh
# ─────────────────────────────────────────────────────────────
# MediaFetch — Linux kurulum
#
# yt-dlp ve ffmpeg'i proje içindeki ./bin klasörüne indirir. Hiçbir
# şey sistem geneline kurulmaz ve root gerekmez; bu yüzden aynı script
# Pterodactyl konteynerinde de, düz bir Ubuntu sunucusunda da çalışır.
#
#   sh scripts/install-linux.sh
# ─────────────────────────────────────────────────────────────
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN="$ROOT/bin"
mkdir -p "$BIN" "$ROOT/downloads"

say() { printf '%s\n' "$*"; }

# ── İndirme aracı ────────────────────────────────────────────
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fL --retry 3 --connect-timeout 20 -o "$2" "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q --tries=3 -O "$2" "$1"; }
else
  say "HATA: curl veya wget gerekli."
  exit 1
fi

# ── Mimari → yt-dlp / ffmpeg dosya adı ───────────────────────
ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64)  YTDLP_ASSET=yt-dlp_linux;          FFMPEG_ARCH=linux64 ;;
  aarch64|arm64) YTDLP_ASSET=yt-dlp_linux_aarch64;  FFMPEG_ARCH=linuxarm64 ;;
  armv7l|armv7)  YTDLP_ASSET=yt-dlp_linux_armv7l;   FFMPEG_ARCH= ;;
  *) say "HATA: desteklenmeyen mimari: $ARCH"; exit 1 ;;
esac

# ── yt-dlp ───────────────────────────────────────────────────
say "==> yt-dlp indiriliyor ($YTDLP_ASSET)"
fetch "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP_ASSET" "$BIN/yt-dlp.new"
fetch "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS" "$BIN/SHA2-256SUMS.tmp"

# İndirilen dosyayı resmi SHA256 listesiyle doğrula — çalıştırılacak bir
# ikiliyi doğrulamadan yerine koymayız.
EXPECTED=$(grep " \*\{0,1\}$YTDLP_ASSET\$" "$BIN/SHA2-256SUMS.tmp" | awk '{print $1}' | head -n1)
if [ -z "$EXPECTED" ]; then
  say "HATA: SHA2-256SUMS içinde $YTDLP_ASSET satırı yok."
  rm -f "$BIN/yt-dlp.new" "$BIN/SHA2-256SUMS.tmp"
  exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL=$(sha256sum "$BIN/yt-dlp.new" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL=$(shasum -a 256 "$BIN/yt-dlp.new" | awk '{print $1}')
else
  say "HATA: sha256sum/shasum yok, doğrulama yapılamıyor."
  rm -f "$BIN/yt-dlp.new" "$BIN/SHA2-256SUMS.tmp"
  exit 1
fi
rm -f "$BIN/SHA2-256SUMS.tmp"

if [ "$EXPECTED" != "$ACTUAL" ]; then
  say "HATA: yt-dlp SHA256 uyuşmuyor. Kurulum durduruldu."
  say "  beklenen: $EXPECTED"
  say "  gelen   : $ACTUAL"
  rm -f "$BIN/yt-dlp.new"
  exit 1
fi

mv -f "$BIN/yt-dlp.new" "$BIN/yt-dlp"
chmod 755 "$BIN/yt-dlp"
say "    yt-dlp: $("$BIN/yt-dlp" --version 2>/dev/null || echo '?')  (SHA256 doğrulandı)"

# ── ffmpeg ───────────────────────────────────────────────────
# Sistemde varsa onu kullanırız; yoksa (konteyner) statik derlemeyi indiririz.
if [ -x "$BIN/ffmpeg" ]; then
  say "==> ffmpeg zaten ./bin içinde, atlanıyor"
elif command -v ffmpeg >/dev/null 2>&1 && [ "${MEDIAFETCH_FORCE_FFMPEG:-0}" != "1" ]; then
  say "==> ffmpeg sistemde bulundu: $(command -v ffmpeg)"
else
  say "==> ffmpeg (statik derleme) indiriliyor"
  if [ -z "$FFMPEG_ARCH" ]; then
    say "    UYARI: bu mimari i\u00e7in haz\u0131r derleme yok \u2014 elle kur: sudo apt-get install -y ffmpeg"
  else
    TMP=$(mktemp -d)
    # BtbN derlemeleri GitHub'da durur (ffmpeg + ffprobe birlikte). johnvansickle
    # aynas\u0131 yedek: konteyner i\u00e7inden s\u0131k s\u0131k eri\u015filemiyor.
    URL1="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-${FFMPEG_ARCH}-gpl.tar.xz"
    URL2="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"

    GOT=""
    if fetch "$URL1" "$TMP/ffmpeg.tar.xz"; then GOT=1
    elif [ "$FFMPEG_ARCH" = "linux64" ] && fetch "$URL2" "$TMP/ffmpeg.tar.xz"; then GOT=1
    fi

    if [ -n "$GOT" ] && tar -xJf "$TMP/ffmpeg.tar.xz" -C "$TMP" 2>/dev/null; then
      SRC=$(find "$TMP" -type f -name ffmpeg  | head -n1)
      PRB=$(find "$TMP" -type f -name ffprobe | head -n1)
      if [ -n "$SRC" ]; then
        cp "$SRC" "$BIN/ffmpeg"; chmod 755 "$BIN/ffmpeg"
        [ -n "$PRB" ] && { cp "$PRB" "$BIN/ffprobe"; chmod 755 "$BIN/ffprobe"; }
        say "    ffmpeg: $("$BIN/ffmpeg" -version 2>/dev/null | head -n1)"
      else
        say "    UYARI: ar\u015fivde ffmpeg bulunamad\u0131 \u2014 ses/video birle\u015ftirme devre d\u0131\u015f\u0131."
      fi
    else
      say "    UYARI: ffmpeg indirilemedi \u2014 ses/video birle\u015ftirme devre d\u0131\u015f\u0131."
      say "    Ubuntu'da elle: sudo apt-get install -y ffmpeg"
    fi
    rm -rf "$TMP"
  fi
fi

# ── Node bağımlılıkları ──────────────────────────────────────
if [ -f "$ROOT/package.json" ]; then
  say "==> npm bağımlılıkları"
  cd "$ROOT"
  if [ -f package-lock.json ]; then
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev
  else
    npm install --omit=dev
  fi
fi

say ""
say "Kurulum tamam. Başlatmak için:  sh scripts/start.sh"
