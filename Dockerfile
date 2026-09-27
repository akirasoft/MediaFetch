# MediaFetch — Ubuntu/Docker imajı
# Pterodactyl kullanmıyorsan tek komutla ayağa kaldırmak için.
#
#   docker build -t mediafetch .
#   docker run -d --name mediafetch -p 8422:8422 \
#     -e MEDIAFETCH_TOKEN=... -v mediafetch-dl:/app/downloads mediafetch

FROM node:22-bookworm-slim

# ffmpeg paketten gelir; yt-dlp resmi sürümü indirilip SHA256 ile doğrulanır.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) asset=yt-dlp_linux ;; \
      arm64) asset=yt-dlp_linux_aarch64 ;; \
      armhf) asset=yt-dlp_linux_armv7l ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    mkdir -p bin; \
    curl -fL -o bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}"; \
    curl -fL -o /tmp/SUMS "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS"; \
    expected="$(grep " \*\?${asset}$" /tmp/SUMS | awk '{print $1}' | head -n1)"; \
    actual="$(sha256sum bin/yt-dlp | awk '{print $1}')"; \
    [ "$expected" = "$actual" ] || { echo "yt-dlp checksum mismatch" >&2; exit 1; }; \
    chmod 755 bin/yt-dlp; rm -f /tmp/SUMS

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server.js ./
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p downloads && chown -R node:node /app
USER node

ENV MEDIAFETCH_MODE=server \
    MEDIAFETCH_HOST=0.0.0.0 \
    MEDIAFETCH_PORT=8422 \
    MEDIAFETCH_DOWNLOAD_DIR=/app/downloads

EXPOSE 8422

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.MEDIAFETCH_PORT||8422)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
