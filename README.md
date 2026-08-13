# ↓ MediaFetch

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

**A polished, local-first GUI for [yt-dlp](https://github.com/yt-dlp/yt-dlp) — download music & video from YouTube, TikTok, Instagram, SoundCloud and 1,000+ other sites. Ships with a Brave/Chrome browser extension.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows)
![yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-FF0000)
[![Author](https://img.shields.io/badge/author-OuzK-orange)](https://github.com/akirasoft)

---

> ⚠️ **Legal Notice:** This tool is intended for content you have the right to download — public domain, Creative Commons-licensed material, or content where the copyright holder grants permission. Downloading copyrighted material without authorization may violate the platform's Terms of Service and applicable copyright law. **You are solely responsible for how you use this software.** The author provides this tool as-is and accepts no liability for any misuse.

## Features

- **1,000+ supported sites** — YouTube, TikTok, Instagram, SoundCloud, Twitter/X, Vimeo, Twitch and everything else yt-dlp handles
- **TikTok watermark removal** — downloads the clean play stream and applies ffmpeg `delogo` to erase the burned-in watermark
- **MP3 extraction** — 128 / 192 / 320 kbps, any platform
- **MP4 download** — 360p → 4K, H.264 priority (no HEVC codec required)
- **Editor mode** — saves video (silent `.mp4`) and audio (`.wav`) as separate files for DaVinci Resolve / Premiere
- **Playlist support** — detects YouTube/SoundCloud playlist URLs and downloads all items with per-item progress
- **Download history** — persists every completed download locally (`history.json`)
- **Browser notifications** — desktop notification when a download finishes
- **Auto yt-dlp update** — checks for a newer yt-dlp on every server start
- **Browser extension** — one-click download of the current tab from Brave or Chrome (TR / EN / ES UI)
- **Dark & light mode** — follows system theme, full CSS-variable theming
- **Real-time progress** — WebSocket-powered, shows speed, ETA and file name live

---

## Requirements

| Dependency | Notes |
|---|---|
| [Node.js 18+](https://nodejs.org/) | JavaScript runtime |
| [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) | Optional but recommended — enables audio merge, WAV export, TikTok watermark removal. Install via WinGet: `winget install Gyan.FFmpeg` |

> yt-dlp is downloaded automatically on first run — no manual install needed.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/akirasoft/mediafetch.git
cd mediafetch

# 2. Double-click start.bat  (or run manually)
node setup.js   # downloads yt-dlp into bin/
npm install
node server.js
```

The browser opens at **http://localhost:3434** automatically.

**Or just double-click `start.bat`** — it handles everything (yt-dlp download, npm install, server start).

---

## Browser Extension

The `extension/` folder contains a Manifest V3 extension for Brave and Chrome.

**Install (developer mode):**

1. Open `brave://extensions` or `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. The ↓ icon appears in your toolbar

> The extension connects to the local server on port 3434. Start the server first.

**Extension UI languages:** Turkish · English · Spanish (saved per-browser)

---

## Project Structure

```
mediafetch/
├── server.js          # Express + WebSocket server, all download logic
├── setup.js           # One-time yt-dlp downloader
├── start.bat          # Windows launcher (setup + npm install + server)
├── public/
│   ├── index.html     # Main web UI
│   ├── app.js         # Frontend JS (WebSocket client, UI logic)
│   └── style.css      # Full design system (dark/light tokens)
├── extension/
│   ├── manifest.json  # MV3, permissions: activeTab, tabs, storage
│   ├── popup.html     # Extension popup
│   ├── popup.js       # i18n (TR/EN/ES), WebSocket client
│   └── popup.css      # Dark extension theme
├── bin/               # yt-dlp.exe lives here (gitignored)
└── downloads/         # Default output folder (gitignored)
```

---

## How It Works

```
Browser / Extension
      │  HTTP POST /api/download
      ▼
  Express server (port 3434)
      │  spawns yt-dlp (or direct HTTPS for TikTok)
      ▼
  yt-dlp / ffmpeg
      │  progress lines parsed in real-time
      ▼
  WebSocket broadcast → all connected clients
```

**TikTok special path:**
1. Fetches the embed page (`tiktok.com/embed/v2/<id>`) with Node.js `https`
2. Extracts the `<video src>` play URL (combined H.264 + AAC, no auth required)
3. Downloads the file directly (0–75% progress)
4. Runs `ffprobe` to get frame dimensions
5. Applies `ffmpeg delogo` filter to erase the bottom-right watermark region
6. Saves the clean `.mp4`

---

## Supported Platforms (highlighted)

| Platform | Audio | Video | Notes |
|---|---|---|---|
| YouTube | ✅ | ✅ | Playlists supported |
| SoundCloud | ✅ | — | Playlists supported |
| TikTok | ✅ | ✅ | Watermark removed via delogo |
| Instagram | ✅ | ✅ | Reels, posts |
| Twitter / X | ✅ | ✅ | |
| Vimeo | ✅ | ✅ | |
| Twitch | ✅ | ✅ | Clips & VODs |
| 1,000+ others | ✅ | ✅ | Anything yt-dlp supports |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/info` | Get video metadata & available formats |
| `POST` | `/api/download` | Start a download |
| `POST` | `/api/cancel/:id` | Cancel an active download |
| `GET` | `/api/history` | List download history |
| `POST` | `/api/history/clear` | Clear history |
| `POST` | `/api/playlist-info` | Get playlist title & item count |
| `POST` | `/api/update-ytdlp` | Manually trigger yt-dlp update |
| `GET` | `/api/ffmpeg-status` | Check if ffmpeg is available |
| `GET` | `/api/default-dir` | Get default download directory |
| `WS` | `ws://localhost:3434` | Real-time progress events |

---

## WebSocket Events

```json
{ "type": "filename",   "downloadId": "...", "filename": "song.mp3" }
{ "type": "progress",   "downloadId": "...", "percent": 45.2, "speed": "2.1MiB/s", "eta": "00:12" }
{ "type": "status",     "downloadId": "...", "message": "Birleştiriliyor..." }
{ "type": "complete",   "downloadId": "..." }
{ "type": "error",      "downloadId": "...", "message": "..." }
{ "type": "cancelled",  "downloadId": "..." }
{ "type": "ytdlp-version", "version": "2026.07.04" }
```

---

## Author

Made by **[OuzK](https://github.com/akirasoft)**

---

## License

MIT — see [LICENSE](LICENSE)
