# MediaFetch

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

> 🖥️ **This is the server / VPS edition** — install on Ubuntu, Docker, or Pterodactyl and share with friends. Each person gets their own access key; downloaded files go straight to their computer, nothing stays on the server.  
> 💻 Just want it on your own Windows PC? → **[mediafetch-local](https://github.com/akirasoft/mediafetch-local)**

Download music & video from YouTube, TikTok, Instagram, SoundCloud, and 1,000+ sites.  
Self-host on your own VPS, give friends personal access keys — files go straight to **their** computer, nothing stays on the server.

---

## How It Works

```
User → Browser / Chrome Extension
              ↓
    MediaFetch Server (your VPS)
              ↓
     yt-dlp downloads the file
              ↓
  File is sent to the user's browser
              ↓
      Saved on their computer
  (deleted from the server instantly)
```

---

## Requirements

| | Minimum |
|---|---|
| OS | Ubuntu 20.04+ / Debian 11+ |
| RAM | 512 MB |
| Disk | 2 GB |
| Node.js | 18+ |
| yt-dlp | installed automatically |
| ffmpeg | installed automatically |

---

## Installation (Ubuntu / Debian)

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x.x
```

### 2. Clone the project

```bash
git clone https://github.com/akirasoft/mediafetch.git
cd mediafetch
npm install --omit=dev
```

### 3. Install yt-dlp and ffmpeg

```bash
bash scripts/install-linux.sh
```

This script:
- Downloads yt-dlp for your architecture and verifies SHA256
- Installs a static ffmpeg build
- Places both in the `bin/` directory

### 4. Set environment variables

```bash
cp .env.example .env
nano .env
```

Edit `.env`:

```env
# Owner password — at least 24 random characters
MEDIAFETCH_TOKEN=replace_with_a_strong_password

# Port to listen on (must be open in your firewall)
SERVER_PORT=8422

# Public address of your server (use a subdomain if you have one)
MEDIAFETCH_PUBLIC_URL=http://YOUR_SERVER_IP:8422

# File retention in minutes — 0 = delete immediately after transfer
MEDIAFETCH_RETENTION_MIN=0
```

### 5. Start

```bash
node server.js
```

You should see:
```
✓ MediaFetch running in server mode
✓ Listening on http://0.0.0.0:8422
✓ Login: http://YOUR_SERVER_IP:8422/login?t=...
```

---

## Run in the Background (PM2)

Keep the server running after you close the terminal:

```bash
sudo npm install -g pm2
pm2 start server.js --name mediafetch
pm2 startup          # auto-start on reboot
pm2 save
```

Useful commands:

```bash
pm2 logs mediafetch    # live logs
pm2 restart mediafetch # restart
pm2 stop mediafetch    # stop
```

---

## Docker (Alternative)

```bash
cp .env.example .env
# edit .env as shown above

docker compose up -d
```

Stop:
```bash
docker compose down
```

---

## Firewall

Open the port (UFW):

```bash
sudo ufw allow 8422/tcp
sudo ufw reload
```

---

## Free HTTPS (Cloudflare Tunnel)

No static IP, or want HTTPS? Add to `.env`:

```env
MEDIAFETCH_TUNNEL=1
```

On next start the server prints a `https://xxxx.trycloudflare.com` URL.  
**Note:** The free tunnel URL changes on every restart. For a stable address, set `MEDIAFETCH_PUBLIC_URL` with an HTTP address.

---

## Giving Friends Access

1. Log in with your owner token: `http://YOUR_SERVER_IP:8422/login?t=YOUR_TOKEN`
2. **Settings → Access Keys**
3. Type a name → **Create**
4. Click the chain icon (🔗) → copy the link → send it to your friend

Each person gets their own key:
- You can see who downloaded what in history
- Revoking one key doesn't affect others
- Keys survive server restarts

---

## Chrome / Brave Extension

### Install

1. Open `brave://extensions` or `chrome://extensions`
2. **Developer mode** → ON
3. **Load unpacked** → select the `extension/` folder
4. Click the extension icon → ⚙ Settings:

| Field | Value |
|---|---|
| Server URL | `http://YOUR_SERVER_IP:8422` |
| Token | Your access key |
| Auto-save | ✅ |

### Usage

Go to a YouTube / TikTok / Instagram / SoundCloud page →  
A **purple ↓ button** appears at the bottom-right → click → pick a format → file downloads to your computer.

Supported: YouTube, YouTube Shorts, TikTok, Instagram Reels,  
Twitter/X videos, SoundCloud, Vimeo, and 1,000+ sites supported by yt-dlp.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MEDIAFETCH_TOKEN` | — | **Required** — owner password |
| `SERVER_PORT` | `8422` | Port to listen on |
| `MEDIAFETCH_PUBLIC_URL` | — | Publicly reachable address |
| `MEDIAFETCH_RETENTION_MIN` | `0` | File retention (minutes), 0 = instant delete |
| `MEDIAFETCH_TUNNEL` | `0` | `1` = start Cloudflare tunnel |
| `MEDIAFETCH_DOWNLOAD_DIR` | `downloads/` | Download directory |
| `MEDIAFETCH_MODE` | auto | `server` or `local` |

---

## Tests

```bash
npm test
```

66 tests: TikTok downloads (32), server modes (18), access keys (16).

---

## Run Locally (Windows / macOS)

Don't want a server? There's a standalone local version:

👉 **[mediafetch-local](https://github.com/akirasoft/mediafetch-local)** — runs entirely on your own machine, includes yt-dlp, ffmpeg, and the browser extension.

---

## License

MIT — free for commercial use.  
yt-dlp and ffmpeg are subject to their own licenses.
