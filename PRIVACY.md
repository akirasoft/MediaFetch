# Privacy Policy — MediaFetch

MediaFetch is a **local application** that runs entirely on your computer. It does not have a central server, user accounts, tracking, analytics, or advertising.

---

## What network connections does MediaFetch make?

### 1. Media downloads — YouTube, TikTok, SoundCloud, etc.
- **When:** Every time you analyze a URL or download media.
- **Where:** Directly to the platform you are downloading from (e.g. YouTube, TikTok, Instagram).
- **What is sent:** The URL you provide. Your IP address is visible to the platform, as with any normal browser visit.
- **Who controls this:** You. MediaFetch sends no data to any server of its own.

### 2. yt-dlp updates — github.com/yt-dlp/yt-dlp
- **When:**
  - **Manual only (default):** Only when you click *Check for Updates* or *Install Update* in Settings.
  - **On startup (opt-in):** Only if you enable *Automatically check for updates on startup* in Settings. This setting is **off by default**.
- **Where:** Directly to `api.github.com/repos/yt-dlp/yt-dlp/releases/latest` and GitHub's release CDN. **No MediaFetch server is involved.**
- **What is sent:** A standard HTTPS request with a `User-Agent` header identifying MediaFetch. Your IP address is visible to GitHub/Fastly, the same as visiting github.com in your browser.
- **Why:** To check the latest yt-dlp version and download the official binary.
- **Verification:** The downloaded binary is verified against the official `SHA2-256SUMS` file published in the same GitHub release before replacing the existing binary.

### 3. Thumbnail proxy — TikTok / Instagram CDNs
- **When:** When you analyze a TikTok or Instagram URL and a thumbnail is displayed.
- **Where:** MediaFetch's local server fetches the thumbnail image from the platform's CDN on your behalf (to work around CORS restrictions). The request goes from your computer to the platform's CDN.
- **What is sent:** A request for the thumbnail image URL only.

### 4. TikTok embed page (watermark removal)
- **When:** When you download a TikTok video.
- **Where:** `https://www.tiktok.com/embed/v2/{video-id}`
- **Why:** TikTok's embed player provides audio+video in a single stream, enabling watermark removal.

---

## What data is stored locally?

| Data | Location | Purpose |
|------|----------|---------|
| Download history | `history.json` | Shown in the sidebar. Never sent anywhere. |
| App settings | `settings.json` | Auto-update preference. Never sent anywhere. |
| yt-dlp binary | `bin/yt-dlp.exe` | The download tool. |

---

## What does MediaFetch NOT do?

- Does **not** collect, transmit, or sell any user data.
- Does **not** use analytics, crash reporting, or telemetry of any kind.
- Does **not** use a custom update server — all update connections go directly to official GitHub releases.
- Does **not** display advertising.
- Does **not** create user accounts or require login.
- Does **not** run in the background when you close it.

---

## Open source

MediaFetch is open source. You can inspect every network request the app makes by reading `server.js`.

Repository: https://github.com/akirasoft/mediafetch
