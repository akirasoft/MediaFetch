# Updates — MediaFetch

## How updates work

**How is MediaFetch updated?**
MediaFetch itself has no auto-update system. To get a new version, pull the latest code from the repository (`git pull`) and restart the server.

**Where does yt-dlp update from?**
Directly from the official GitHub releases page: `github.com/yt-dlp/yt-dlp`. No third-party or custom server is involved.

**Is the update from an official source?**
Yes. MediaFetch fetches from `api.github.com/repos/yt-dlp/yt-dlp/releases/latest` and downloads the binary from GitHub's CDN — the same place as a manual download.

**Is auto-update off by default?**
Yes. Automatic update checks on startup are disabled by default. You can enable them in Settings → *Automatically check for updates on startup*.

**If an update fails, is the existing binary preserved?**
Yes. The new binary is downloaded to a temporary file first and verified against the official SHA256 checksum. The existing `yt-dlp.exe` is only replaced after verification passes. If anything fails, the temp file is deleted and the original is untouched.

**How do I check for updates manually?**
Open the web UI → click the ⚙ icon → *Check for Updates*. If a new version is available, click *Install Update*.

---

## Recent changes

### Extension
- New icon: waveform + download arrow (dark background, green bars)
- New theme: macOS Midnight — navy-black background, indigo accent, system font, traffic-light title bar
- Header updated from old "indirici" branding to MediaFetch

### Web UI
- Settings modal with yt-dlp version display and update controls
- TR / EN / ES language support
- yt-dlp update badge (⚙ button with notification dot)

### yt-dlp update system
- Manual update check via GitHub API
- SHA256 verification before replacing binary
- Opt-in startup check (off by default)
- Real-time log and progress bar during download

### Security
- Shell command injection fix (`spawn` instead of `exec`)
- URL scheme validation on all user-supplied URLs
- Thumbnail proxy blocks private/loopback IP ranges (SSRF protection)

### Docs
- `PRIVACY.md` added — full breakdown of every network connection the app makes
