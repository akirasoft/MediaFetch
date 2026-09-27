const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn, execFile, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── Platform ──────────────────────────────────
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const EXE = IS_WIN ? '.exe' : '';

function whichSync(cmd) {
  try {
    const out = execSync(IS_WIN ? `where ${cmd}` : `command -v ${cmd}`, {
      timeout: 4000, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim().split('\n')[0].trim();
    return out && fs.existsSync(out) ? out : '';
  } catch { return ''; }
}

const envStr = (name, dflt = '') => {
  const v = process.env[name];
  return (v === undefined || v === '') ? dflt : String(v).trim();
};
const envBool = (name, dflt) => {
  const v = envStr(name);
  return v ? /^(1|true|yes|on)$/i.test(v) : dflt;
};
const envInt = (name, dflt) => {
  const n = parseInt(envStr(name), 10);
  return Number.isFinite(n) ? n : dflt;
};

// ── Runtime mode ─────────────────────────────
// local  : desktop use — binds loopback, opens the browser, any output folder,
//          can reveal that folder in the file manager.
// server : headless/hosted use (Ubuntu, Pterodactyl, Docker) — binds every
//          interface, never touches a desktop, the output folder is fixed, and
//          finished files are streamed back to the client over HTTP.
// Auto-detected: Pterodactyl exports SERVER_PORT, a headless box has no DISPLAY.
// MEDIAFETCH_MODE always wins.
const MODE = (() => {
  const m = envStr('MEDIAFETCH_MODE').toLowerCase();
  if (m === 'server' || m === 'remote') return 'server';
  if (m === 'local') return 'local';
  if (process.env.SERVER_PORT || process.env.P_SERVER_UUID) return 'server';
  if (envBool('MEDIAFETCH_DOCKER', false)) return 'server';
  if (!IS_WIN && !IS_MAC && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return 'server';
  return 'local';
})();
const SERVER_MODE = MODE === 'server';

// Port. Pterodactyl injects SERVER_PORT, so that wins. 3434 stays the local
// default (existing extension/bookmarks keep working); 8422 is the hosted
// default, picked to stay clear of 80/443/3000/3306/5000/8000/8080/8888.
const PORT = envInt('SERVER_PORT', envInt('MEDIAFETCH_PORT', envInt('PORT', SERVER_MODE ? 8422 : 3434)));
const HOST = envStr('MEDIAFETCH_HOST', SERVER_MODE ? '0.0.0.0' : '127.0.0.1');

// Shared secret. The API spawns yt-dlp, so an unauthenticated instance on a
// public IP is an open downloader — set this whenever the port is reachable.
const TOKEN = envStr('MEDIAFETCH_TOKEN');
const PUBLIC_URL = envStr('MEDIAFETCH_PUBLIC_URL').replace(/\/+$/, '');

// ── Binaries ─────────────────────────────────
const BIN_DIR = path.join(__dirname, 'bin');

// GitHub release asset that matches this platform.
const YTDLP_ASSET = IS_WIN ? 'yt-dlp.exe'
  : IS_MAC ? 'yt-dlp_macos'
  : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64'
  : process.arch === 'arm' ? 'yt-dlp_linux_armv7l'
  : 'yt-dlp_linux';

// Where a self-update writes. Always inside the app, never over a system binary.
const YTDLP_TARGET = path.join(BIN_DIR, 'yt-dlp' + EXE);

function resolveYtDlp() {
  const fromEnv = envStr('MEDIAFETCH_YTDLP');
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (fs.existsSync(YTDLP_TARGET)) return YTDLP_TARGET;
  const onPath = whichSync('yt-dlp');
  if (onPath) return onPath;
  return YTDLP_TARGET;           // missing — the /api guards report it
}
let YT_DLP = resolveYtDlp();

// FFMPEG_PATH is a directory (that is what yt-dlp's --ffmpeg-location wants);
// FFMPEG_BIN / FFPROBE_BIN are the executables this server runs directly.
function findFfmpeg() {
  const fromEnv = envStr('MEDIAFETCH_FFMPEG');
  if (fromEnv) {
    try {
      const dir = fs.statSync(fromEnv).isDirectory() ? fromEnv : path.dirname(fromEnv);
      if (fs.existsSync(path.join(dir, 'ffmpeg' + EXE))) return dir;
    } catch {}
  }
  // A static build dropped into ./bin by scripts/install-linux.sh comes next —
  // inside a Pterodactyl container it is the only copy guaranteed to exist.
  if (fs.existsSync(path.join(BIN_DIR, 'ffmpeg' + EXE))) return BIN_DIR;

  if (IS_WIN) {
    const wingetBase = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetBase)) {
      try {
        for (const vendor of fs.readdirSync(wingetBase)) {
          if (!vendor.toLowerCase().includes('ffmpeg')) continue;
          const vendorDir = path.join(wingetBase, vendor);
          for (const ver of fs.readdirSync(vendorDir)) {
            const bin = path.join(vendorDir, ver, 'bin', 'ffmpeg.exe');
            if (fs.existsSync(bin)) return path.dirname(bin);
          }
        }
      } catch {}
    }
    for (const c of [
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    ]) {
      if (fs.existsSync(c)) return path.dirname(c);
    }
  } else {
    for (const c of [
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/snap/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/opt/ffmpeg/bin/ffmpeg',
    ]) {
      if (fs.existsSync(c)) return path.dirname(c);
    }
  }

  const onPath = whichSync('ffmpeg');
  if (onPath) return path.dirname(onPath);
  return '';
}

const FFMPEG_PATH = findFfmpeg();
const FFMPEG_BIN = FFMPEG_PATH ? path.join(FFMPEG_PATH, 'ffmpeg' + EXE) : '';
const FFPROBE_BIN = FFMPEG_PATH ? path.join(FFMPEG_PATH, 'ffprobe' + EXE) : '';

// ── Output folder ────────────────────────────
// Local: the user's Downloads folder. Server: a folder inside the app, because
// there a finished file is fetched back over HTTP instead of opened on the host.
const DEFAULT_DOWNLOAD_DIR = (() => {
  const fromEnv = envStr('MEDIAFETCH_DOWNLOAD_DIR');
  if (fromEnv) return path.resolve(fromEnv);
  if (SERVER_MODE) return path.join(__dirname, 'downloads');
  const home = path.join(os.homedir(), 'Downloads');
  return fs.existsSync(home) ? home : path.join(__dirname, 'downloads');
})();

// Only local mode may write outside DEFAULT_DOWNLOAD_DIR.
const ALLOW_CUSTOM_DIR = envBool('MEDIAFETCH_ALLOW_CUSTOM_DIR', !SERVER_MODE);
// Revealing a folder and auto-opening a browser both need a desktop session.
const ALLOW_OPEN_FOLDER = envBool('MEDIAFETCH_ALLOW_OPEN_FOLDER', !SERVER_MODE);
const AUTO_OPEN_BROWSER = envBool('MEDIAFETCH_OPEN_BROWSER', !SERVER_MODE);
// Delete finished files after N minutes (0 = keep forever).
const RETENTION_MIN = envInt('MEDIAFETCH_RETENTION_MIN', SERVER_MODE ? 1440 : 0);

try { fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true }); } catch {}

console.log(`mode: ${MODE} · ${process.platform}/${process.arch} · node ${process.versions.node}`);
console.log(fs.existsSync(YT_DLP) ? `yt-dlp: ${YT_DLP}` : `yt-dlp NOT FOUND (expected at ${YT_DLP})`);
console.log(FFMPEG_PATH ? `ffmpeg found: ${FFMPEG_PATH}` : 'ffmpeg not found — audio/video merge disabled');
console.log(`output dir: ${DEFAULT_DOWNLOAD_DIR}`);
if (SERVER_MODE && !TOKEN) {
  console.warn('WARNING: MEDIAFETCH_TOKEN is not set — anyone who can reach this port can use the API.');
}

// ── Download history ─────────────────────────────────────────
const HISTORY_FILE = path.join(__dirname, 'history.json');

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function appendHistory({ url, title, filename, user }) {
  const hist = readHistory();
  hist.unshift({
    url, title: title || filename || '', filename: filename || '',
    user: user || '', date: new Date().toISOString(),
  });
  if (hist.length > 500) hist.length = 500;
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist)); } catch {}
}

// ── Settings ─────────────────────────────────────────────────
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function readSettings() {
  try { return { autoUpdate: false, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; }
  catch { return { autoUpdate: false }; }
}

function saveSettings(s) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); } catch {}
}

// ── Per-person access keys ───────────────────────────
// MEDIAFETCH_TOKEN stays the owner's key: it is the only one that can mint or
// revoke the others. Everyone else gets their own key, so access can be handed
// out and taken back one person at a time instead of rotating one shared secret.
const KEYS_FILE = path.join(__dirname, 'keys.json');

function readKeys() {
  try {
    const parsed = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    return Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch { return []; }
}

function saveKeys(keys) {
  const tmp = KEYS_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify({ keys }, null, 2));
    fs.renameSync(tmp, KEYS_FILE);
    return true;
  } catch {
    try { fs.unlinkSync(tmp); } catch {}
    return false;
  }
}

function newKeyValue() {
  return crypto.randomBytes(24).toString('hex');
}

// Record usage without rewriting the file on every single request.
let keyTouchPending = false;
function touchKey(entry) {
  entry.lastUsed = new Date().toISOString();
  if (keyTouchPending) return;
  keyTouchPending = true;
  setTimeout(() => {
    keyTouchPending = false;
    const keys = readKeys();
    const target = keys.find(k => k.id === entry.id);
    if (target) {
      target.lastUsed = entry.lastUsed;
      target.downloads = entry.downloads || target.downloads || 0;
      saveKeys(keys);
    }
  }, 5000).unref();
}

function countKeyDownload(id) {
  if (!id) return;
  const keys = readKeys();
  const target = keys.find(k => k.id === id);
  if (!target) return;
  target.downloads = (target.downloads || 0) + 1;
  target.lastUsed = new Date().toISOString();
  saveKeys(keys);
}

// ── yt-dlp version ────────────────────────────────────────────
let cachedYtDlpVersion = '';

function fetchYtDlpVersion(cb) {
  if (!fs.existsSync(YT_DLP)) return cb && cb('');
  const p = spawn(YT_DLP, ['--version']);
  let v = '';
  let done = false;
  const finish = (val) => { if (done) return; done = true; clearTimeout(t); cb && cb(val); };
  const t = setTimeout(() => { try { p.kill(); } catch {} finish(''); }, 8000);
  p.stdout.on('data', d => { v += d.toString(); });
  p.on('close', () => { cachedYtDlpVersion = v.trim(); finish(cachedYtDlpVersion); });
  p.on('error', () => finish(''));
}

// ── Update system — direct from github.com/yt-dlp/yt-dlp ────
const GITHUB_UA = 'MediaFetch/1.0.0 (https://github.com/akirasoft/mediafetch)';

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get({
      hostname: 'api.github.com',
      path: '/repos/yt-dlp/yt-dlp/releases/latest',
      headers: { 'User-Agent': GITHUB_UA, 'Accept': 'application/vnd.github.v3+json' },
    }, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        if (res.statusCode === 403 || res.statusCode === 429) {
          reject(new Error('GitHub API rate limit reached. Try again later.'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from GitHub API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('GitHub API request timed out')); });
  });
}

function downloadText(url, depth) {
  depth = depth || 0;
  if (depth > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': GITHUB_UA } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve(downloadText(res.headers.location, depth + 1));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function downloadFile(url, dest, onProgress, depth) {
  depth = depth || 0;
  if (depth > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': GITHUB_UA } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve(downloadFile(res.headers.location, dest, onProgress, depth + 1));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', chunk => {
        downloaded += chunk.length;
        if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100));
      });
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', err => { try { fs.unlinkSync(dest); } catch {} reject(err); });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('Download timed out')); });
  });
}

function parseSHA256Sums(content, filename) {
  for (const line of content.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === filename && parts[0].length === 64) {
      return parts[0].toLowerCase();
    }
  }
  return null;
}

function computeSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const { createHash } = require('crypto');
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function performUpdate() {
  const log = (msg) => broadcast({ type: 'update-log', message: msg });

  log('Fetching release info from api.github.com/repos/yt-dlp/yt-dlp...\n');
  const release = await fetchLatestRelease();
  const latest = release.tag_name;
  const exeAsset = (release.assets || []).find(a => a.name === YTDLP_ASSET);
  const sumsAsset = (release.assets || []).find(a => a.name === 'SHA2-256SUMS');

  if (!exeAsset || !sumsAsset) {
    throw new Error(`Expected assets (${YTDLP_ASSET}, SHA2-256SUMS) not found in GitHub release`);
  }

  log(`Latest:  ${latest}\n`);
  log(`Current: ${cachedYtDlpVersion || '(not installed)'}\n\n`);

  if (cachedYtDlpVersion && cachedYtDlpVersion === latest) {
    log('Already up to date.\n');
    broadcast({ type: 'update-complete', version: latest, alreadyLatest: true });
    return;
  }

  // Ensure bin directory exists
  const binDir = path.join(__dirname, 'bin');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  log('Downloading SHA2-256SUMS checksum file...\n');
  const sumsContent = await downloadText(sumsAsset.browser_download_url);
  const expectedHash = parseSHA256Sums(sumsContent, YTDLP_ASSET);
  if (!expectedHash) throw new Error(`${YTDLP_ASSET} entry not found in SHA2-256SUMS`);

  log(`Expected SHA256:\n  ${expectedHash}\n\n`);

  const sizeMB = exeAsset.size ? `~${(exeAsset.size / 1024 / 1024).toFixed(1)} MB` : '';
  log(`Downloading ${YTDLP_ASSET} ${sizeMB}...\n`);
  broadcast({ type: 'update-progress', percent: 0 });

  const tmpPath = YTDLP_TARGET + '.download';
  await downloadFile(exeAsset.browser_download_url, tmpPath, (pct) => {
    broadcast({ type: 'update-progress', percent: pct });
  });

  log('\nVerifying checksum...\n');
  const actualHash = await computeSHA256(tmpPath);
  log(`Actual SHA256:\n  ${actualHash}\n\n`);

  if (actualHash !== expectedHash) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw new Error(
      'Checksum mismatch — the downloaded file may be corrupted or tampered.\n' +
      'Update aborted. Your existing yt-dlp binary is unchanged.'
    );
  }

  log('Checksum verified ✓\n');
  log('Replacing binary...\n');

  // Backup existing binary, replace with new one. The update always lands in
  // ./bin — never over a system-wide yt-dlp we happened to resolve from PATH.
  const backupPath = YTDLP_TARGET + '.bak';
  if (fs.existsSync(YTDLP_TARGET)) {
    try { fs.renameSync(YTDLP_TARGET, backupPath); } catch {}
  }
  fs.renameSync(tmpPath, YTDLP_TARGET);
  if (!IS_WIN) { try { fs.chmodSync(YTDLP_TARGET, 0o755); } catch {} }
  YT_DLP = YTDLP_TARGET;
  try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch {}

  broadcast({ type: 'update-progress', percent: 100 });
  log(`Updated to ${latest} ✓\n`);

  await new Promise((resolve) => {
    fetchYtDlpVersion(ver => {
      if (ver) broadcast({ type: 'ytdlp-version', version: ver });
      resolve();
    });
  });

  broadcast({ type: 'update-complete', version: latest });
}

// Node.js runtime arg — YouTube format resolution
const NODE_PATH = (process.execPath && fs.existsSync(process.execPath))
  ? process.execPath
  : whichSync('node');
const JS_RUNTIME_ARGS = NODE_PATH ? ['--js-runtimes', `node:${NODE_PATH}`] : [];

// ── TikTok helpers ────────────────────────────────────────────
// Hosts we trust to serve TikTok media. Used to keep the play URL that
// is scraped from the (untrusted) embed page from being turned into an
// SSRF or a redirect to an arbitrary host.
const TIKTOK_MEDIA_HOSTS = [
  'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com',
  'tiktokv.com', 'tiktokv.us', 'tiktok.com',
  'ibyteimg.com', 'ibytedtos.com', 'muscdn.com', 'byteoversea.com',
];

function isSafeTikTokMediaUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  // Block loopback / private / link-local targets outright.
  if (/^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/.test(host)) return false;
  return TIKTOK_MEDIA_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

// Resolution-aware yt-dlp format selector for TikTok.
// TikTok is normally a single progressive MP4 (video+audio together), so a
// progressive selector is tried first; separate video+audio and a bare `best`
// are kept as fallbacks. `height` caps quality but never forces an upscale
// (yt-dlp only filters formats, it does not scale up).
function tiktokVideoFormat(height) {
  const h = parseInt(height, 10);
  if (!Number.isFinite(h) || h <= 0) {
    return 'best[ext=mp4]/bestvideo[vcodec^=avc]+bestaudio/bestvideo+bestaudio/best';
  }
  return [
    `best[height<=${h}][ext=mp4]`,
    `best[height<=${h}]`,
    `bestvideo[height<=${h}][vcodec^=avc]+bestaudio`,
    `bestvideo[height<=${h}]+bestaudio`,
    'best[ext=mp4]',
    'best',
  ].join('/');
}

// JSON-first parsing of the embed page (item #6): real JSON.parse of <script>
// blobs, deep-scanning for a clean playAddr / play_addr. Preferred over regex
// because it survives attribute/markup churn. Keys containing "download" are
// skipped so the watermarked download_addr is never chosen. Regex stays as the
// fallback in runTikTokWatermarkFree.
function ttExtractJsonBlobs(html) {
  const blobs = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = m[1].trim();
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s === -1 || e <= s) continue;
    blobs.push(t.slice(s, e + 1));
  }
  return blobs;
}
function ttPickUrl(v) {
  if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  if (v && typeof v === 'object') {
    const list = v.urlList || v.url_list || v.UrlList;
    if (Array.isArray(list)) {
      const s = list.find(x => typeof x === 'string' && /^https?:\/\//.test(x));
      if (s) return s;
    }
    if (typeof v.url === 'string' && /^https?:\/\//.test(v.url)) return v.url;
  }
  return null;
}
function ttPlayAddrFromJson(root) {
  if (!root || typeof root !== 'object') return null;
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
      const kl = k.toLowerCase();
      if (kl.includes('download')) continue; // never the watermarked source
      if (/^play_?addr$/.test(kl)) { const u = ttPickUrl(v); if (u) return u; }
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return null;
}

// TikTok embed URL — tolerant of query params and canonical/photo forms.
// Returns the embed/v2 URL when a numeric video id can be extracted, else null
// (the caller then uses the yt-dlp resolver, which handles vm./vt. short links
// natively).
function toTikTokEmbedUrl(url) {
  const m = String(url).match(/\/(?:video|v|photo)\/(\d{6,})/);
  if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
  try {
    const u = new URL(url);
    const idParam = u.searchParams.get('item_id') || u.searchParams.get('video_id');
    if (idParam && /^\d{6,}$/.test(idParam)) return `https://www.tiktok.com/embed/v2/${idParam}`;
  } catch {}
  return null;
}

// yt-dlp fallback for TikTok — used when the embed page / CDN is unreliable.
// Honors the requested height and stays watermark-free (yt-dlp does not pick
// the watermarked `download` format by default).
function startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height) {
  broadcast({ type: 'status', downloadId, message: 'Downloading (yt-dlp)...' });
  getTikTokTitle(url, platformArgs).then((title) => {
    const safeName = (title || `tiktok_${downloadId}`).replace(/[\\/:*?"<>|]/g, '_').substring(0, 200);
    const outTpl = path.join(downloadDir, `${safeName}.mp4`);
    broadcast({ type: 'filename', downloadId, filename: `${safeName}.mp4` });
    const args = [
      '--no-playlist',
      '-f', tiktokVideoFormat(height),
      '--merge-output-format', 'mp4',
      ...ffmpegArgs, ...platformArgs,
      '-o', outTpl, '--progress', url
    ];
    startProc(downloadId, args, { url, title: safeName });
  });
}

// TikTok watermark-free download.
// Strategy: pull the clean play address from the embed page and remux it
// losslessly (-c copy). The play address served in the embed page is already
// watermark-free, so NO delogo / re-encode is applied by default. Fixed-region
// delogo destroyed real pixels (TikTok's watermark position is not fixed), and
// re-encoding every clip was needless quality loss. The legacy delogo pass can
// be re-enabled with MEDIAFETCH_TIKTOK_DELOGO=1.
async function runTikTokWatermarkFree(downloadId, url, embedUrl, platformArgs, ffmpegArgs, downloadDir, height) {
  const ffmpegBin = FFMPEG_BIN;
  const ffprobeBin = FFPROBE_BIN;
  const cleanup = (f) => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {} };

  broadcast({ type: 'status', downloadId, message: 'Analyzing TikTok...' });

  const embedPageData = await new Promise((resolve) => {
    const https = require('https');
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = https.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); finish(''); return; }
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => finish(data));
      res.on('error', () => finish(''));
    });
    req.on('error', () => finish(''));
    req.setTimeout(12000, () => { req.destroy(); finish(''); });
  });

  if (!embedPageData) {
    startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
    return;
  }

  const html = embedPageData
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, '&');

  // Collect candidate media URLs from several shapes (TikTok changes the embed
  // page over time), then pick the first one that passes the host allowlist.
  // Order matters: <video> tag and playAddr are watermark-free; download_addr
  // (deliberately not matched) carries a baked-in watermark.
  const candidates = [];
  // JSON-first (item #6): real JSON.parse of embed <script> blobs, before regex.
  for (const blob of ttExtractJsonBlobs(embedPageData)) {
    let obj;
    try { obj = JSON.parse(blob); } catch { continue; }
    const u = ttPlayAddrFromJson(obj);
    if (u) { candidates.push(u); break; }
  }
  const unescape = (s) => s.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\/g, '');
  const videoTagMatch = html.match(/<video[^>]+src="(https:\/\/[^"]+)"/i);
  if (videoTagMatch) candidates.push(unescape(videoTagMatch[1]));
  const jsonUrlMatch = html.match(/"(?:playAddr|play_addr)"\s*:\s*\{[^}]*"[Uu]rl[Ll]ist"\s*:\s*\[\s*"(https:[^"]+)"/);
  if (jsonUrlMatch) candidates.push(unescape(jsonUrlMatch[1]));
  const flatPlay = html.match(/"(?:playAddr|play_addr)"\s*:\s*"(https:[^"]+)"/);
  if (flatPlay) candidates.push(unescape(flatPlay[1]));

  const playUrl = candidates.find(isSafeTikTokMediaUrl) || null;

  if (!playUrl) {
    startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
    return;
  }
  const titleMatch = html.match(/"desc"\s*:\s*"([^"]*)"/);
  const rawTitle = titleMatch ? titleMatch[1] : '';
  const titleFromPage = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
  const title = titleFromPage || (await getTikTokTitle(url, platformArgs)) || `tiktok_${downloadId}`;
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200);

  const tmpRaw = path.join(downloadDir, `_ttraw_${downloadId}.mp4`);
  const finalOut = path.join(downloadDir, `${safeName}.mp4`);

  broadcast({ type: 'filename', downloadId, filename: `${safeName}.mp4` });
  broadcast({ type: 'status', downloadId, message: 'Downloading video...' });

  let downloaded = 0;
  let contentLength = 0;
  let cancelled = false;
  const videoDownloaded = await new Promise((resolve) => {
    const https = require('https');
    const fileStream = fs.createWriteStream(tmpRaw);
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

    function doGet(dlUrl, attempt, depth) {
      if (cancelled) { finish(false); return; }
      if (depth > 5) { finish(false); return; }
      // Every hop (including redirects) must stay on a trusted TikTok host.
      if (!isSafeTikTokMediaUrl(dlUrl)) { finish(false); return; }
      const req = https.get(dlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Range': 'bytes=0-',
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next;
          try { next = new URL(res.headers.location, dlUrl).toString(); } catch { finish(false); return; }
          doGet(next, attempt, depth + 1);
          return;
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          if (attempt < 3) setTimeout(() => doGet(dlUrl, attempt + 1, depth), 1500);
          else finish(false);
          return;
        }
        // An HTML/JSON body here is an error page, not a video — do not save it.
        const ctype = (res.headers['content-type'] || '').toLowerCase();
        if (ctype.includes('text/html') || ctype.includes('application/json')) {
          res.resume();
          if (attempt < 3) setTimeout(() => doGet(dlUrl, attempt + 1, depth), 1500);
          else finish(false);
          return;
        }
        contentLength = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (contentLength > 0) {
            broadcast({ type: 'progress', downloadId, percent: Math.round((downloaded / contentLength) * 75) });
          }
        });
        res.on('error', () => { fileStream.destroy(); finish(false); });
        fileStream.on('error', () => finish(false));
        fileStream.on('finish', () => finish(true));
        res.pipe(fileStream);
      });
      req.on('error', () => {
        if (attempt < 3) setTimeout(() => doGet(dlUrl, attempt + 1, depth), 1500);
        else finish(false);
      });
      req.setTimeout(30000, () => { req.destroy(); });
    }
    doGet(playUrl, 0, 0);

    downloads.set(downloadId, {
      proc: { kill: () => { cancelled = true; fileStream.destroy(); finish(false); } }
    });
  });

  const rawSize = (videoDownloaded && fs.existsSync(tmpRaw)) ? fs.statSync(tmpRaw).size : 0;
  if (!videoDownloaded || rawSize < 10000) {
    cleanup(tmpRaw);
    downloads.delete(downloadId);
    if (cancelled) return;
    startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
    return;
  }

  broadcast({ type: 'progress', downloadId, percent: 77 });
  broadcast({ type: 'status', downloadId, message: 'Validating...' });

  // Confirm the raw download really is a video (rejects HTML/garbage saved as .mp4).
  const probeOut = await new Promise((resolve) => {
    execFile(ffprobeBin, [
      '-v', 'quiet', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0', tmpRaw
    ], (err, stdout) => {
      if (err || !stdout.trim()) { resolve(null); return; }
      const parts = stdout.trim().split(',');
      const w = parseInt(parts[0], 10), h = parseInt(parts[1], 10);
      resolve((w && h) ? { w, h } : null);
    });
  });

  if (!probeOut) {
    cleanup(tmpRaw);
    downloads.delete(downloadId);
    startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
    return;
  }

  const runFfmpeg = (args) => new Promise((resolve) => {
    const proc = spawn(ffmpegBin, args);
    downloads.set(downloadId, { proc });
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      const m = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m) {
        const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        const pct = Math.min(97, 80 + Math.round(secs * 17 / 30));
        broadcast({ type: 'progress', downloadId, percent: pct });
      }
    });
    proc.on('close', (code) => resolve(code));
    proc.on('error', () => resolve(1));
  });

  broadcast({ type: 'progress', downloadId, percent: 80 });
  broadcast({ type: 'status', downloadId, message: 'Finalizing...' });

  let produced = false;

  // Optional legacy delogo pass — OFF by default (source is already clean).
  if (process.env.MEDIAFETCH_TIKTOK_DELOGO === '1') {
    const tlW = Math.round(probeOut.w * 0.32), tlH = Math.round(probeOut.h * 0.09);
    const brX = Math.round(probeOut.w * 0.78), brY = Math.round(probeOut.h * 0.86);
    const brW = probeOut.w - brX - 2, brH = probeOut.h - brY - 2;
    const delogoFilter = `delogo=x=2:y=2:w=${tlW}:h=${tlH}:show=0,delogo=x=${brX}:y=${brY}:w=${brW}:h=${brH}:show=0`;
    await runFfmpeg(['-i', tmpRaw, '-vf', delogoFilter, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-y', finalOut]);
    produced = fs.existsSync(finalOut) && fs.statSync(finalOut).size > 10000;
  }

  // Preferred path: lossless remux of the already-clean source.
  if (!produced) {
    cleanup(finalOut);
    await runFfmpeg(['-i', tmpRaw, '-c', 'copy', '-movflags', '+faststart', '-y', finalOut]);
    produced = fs.existsSync(finalOut) && fs.statSync(finalOut).size > 10000;
  }

  // Last resort: re-encode into a standard MP4 if the container needs it.
  if (!produced) {
    cleanup(finalOut);
    await runFfmpeg(['-i', tmpRaw, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-y', finalOut]);
    produced = fs.existsSync(finalOut) && fs.statSync(finalOut).size > 10000;
  }

  cleanup(tmpRaw);
  downloads.delete(downloadId);

  // Final validation: the output must contain a real video stream.
  const finalOk = produced && await new Promise((resolve) => {
    execFile(ffprobeBin, ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', finalOut],
      (err, stdout) => resolve(!err && /video/.test(stdout)));
  });

  if (finalOk) {
    broadcast({ type: 'progress', downloadId, percent: 100 });
    registerFinished(downloadId, finalOut);
    broadcast(completionPayload(downloadId, `${safeName}.mp4`));
    appendHistory({ url, title: safeName, filename: `${safeName}.mp4`, user: ownerOf(downloadId) });
  } else {
    cleanup(finalOut);
    startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
  }
}

function getTikTokTitle(url, platformArgs) {
  return new Promise((resolve) => {
    let title = '';
    const proc = spawn(YT_DLP, ['--no-playlist', '--print', 'title', ...platformArgs, url]);
    proc.stdout.on('data', (d) => { title += d.toString(); });
    proc.on('close', () => resolve(title.trim().replace(/[\\/:*?"<>|]/g, '_') || ''));
    proc.on('error', () => resolve(''));
    setTimeout(() => { try { proc.kill(); } catch {} resolve(''); }, 8000);
  });
}

function getPlatformArgs(url) {
  const u = url.toLowerCase();
  const args = [];
  if (u.includes('tiktok.com')) {
    args.push('--impersonate', 'chrome');
    args.push('--add-header', 'Referer:https://www.tiktok.com/');
  } else if (u.includes('instagram.com')) {
    args.push('--add-header', 'Referer:https://www.instagram.com/');
    args.push(...JS_RUNTIME_ARGS);
  } else if (u.includes('twitter.com') || u.includes('x.com')) {
    args.push('--impersonate', 'chrome');
    args.push(...JS_RUNTIME_ARGS);
  } else {
    args.push(...JS_RUNTIME_ARGS);
  }
  return args;
}

// ── Auth ─────────────────────────────────────
// One shared token, accepted as a header (extension), a query parameter
// (WebSocket / one-click login link) or a cookie (browser session).
const AUTH_COOKIE = 'mf_token';
const AUTH_HEADER = 'x-mediafetch-token';

function safeEq(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function tokenFromCookie(cookieHeader) {
  const m = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + AUTH_COOKIE + '=([^;]*)'));
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

// Who is calling: the owner, a named person, or nobody.
function identify(token) {
  if (!token) return null;
  if (TOKEN && safeEq(token, TOKEN)) return { admin: true, id: '', name: 'owner' };
  for (const entry of readKeys()) {
    if (entry.disabled) continue;
    if (safeEq(token, entry.key)) {
      touchKey(entry);
      return { admin: false, id: entry.id, name: entry.name || '' };
    }
  }
  return null;
}

function tokenFromReq(req) {
  const h = req.headers[AUTH_HEADER] || req.headers['x-auth-token'];
  if (h) return String(h);
  const auth = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  const q = req.query && (req.query.token || req.query.t);
  if (q) return String(q);
  return tokenFromCookie(req.headers.cookie);
}

function loginPage(failed) {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MediaFetch — Giriş</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#0b0d10; color:#e6e8eb;
         font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif }
  form { width:min(340px,90vw); padding:28px; border-radius:16px;
         background:#14171c; border:1px solid #232830 }
  h1 { margin:0 0 4px; font-size:19px }
  p { margin:0 0 20px; color:#8b93a1; font-size:13px }
  input { width:100%; box-sizing:border-box; padding:11px 13px; margin-bottom:12px;
          border-radius:10px; border:1px solid #2b313b; background:#0f1216; color:inherit }
  button { width:100%; padding:11px; border:0; border-radius:10px; cursor:pointer;
           background:#4f8cff; color:#fff; font-weight:600 }
  .err { color:#ff6b6b; font-size:13px; margin:0 0 12px }
</style></head><body>
<form method="GET" action="/login">
  <h1>MediaFetch</h1>
  <p>Bu sunucu korumalı. Erişim anahtarını girin.</p>
  ${failed ? '<p class="err">Anahtar hatalı.</p>' : ''}
  <input type="password" name="t" placeholder="Erişim anahtarı" autofocus required>
  <button type="submit">Giriş</button>
</form></body></html>`;
}

// ── CORS ─────────────────────────────────────
// The browser extension always calls in cross-origin. Now that the server can
// live on another machine, it also sends an auth header, so that header has to
// be allowed and the preflight has to answer before the auth gate.
const ALLOWED_ORIGINS = envStr('MEDIAFETCH_ALLOWED_ORIGINS')
  .split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin.startsWith('chrome-extension://') || origin.startsWith('brave-extension://')
      || origin.startsWith('moz-extension://')) return true;
  return ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''));
}

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MediaFetch-Token, X-Auth-Token, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Liveness probe — intentionally open so a panel or uptime check can use it.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true, mode: MODE, port: PORT, auth: !!TOKEN,
    ytdlp: fs.existsSync(YT_DLP), ffmpeg: !!FFMPEG_PATH,
  });
});

if (TOKEN) {
  // One-click login: http://host:port/login?t=TOKEN stores a cookie so the web
  // UI (and its WebSocket) work for the rest of the session.
  app.get('/login', (req, res) => {
    const given = String((req.query && (req.query.t || req.query.token)) || '');
    if (given && identify(given)) {
      res.setHeader('Set-Cookie',
        `${AUTH_COOKIE}=${encodeURIComponent(given)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
      return res.redirect('/');
    }
    res.status(given ? 401 : 200).type('html').send(loginPage(!!given));
  });

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/api/health') return next();
    const who = identify(tokenFromReq(req));
    if (who) { req.mfAuth = who; return next(); }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized — access token required' });
    }
    res.status(401).type('html').send(loginPage(false));
  });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '256kb' }));

// Extension download — requires auth, streams extension/ folder as a zip
app.get('/extension.zip', auth, (req, res) => {
  const archiver = require('archiver');
  const extDir = path.join(__dirname, 'extension');
  if (!fs.existsSync(extDir)) return res.status(404).json({ error: 'extension dir not found' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="mediafetch-extension.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { if (!res.headersSent) res.status(500).end(); });
  archive.pipe(res);
  archive.directory(extDir, 'mediafetch-extension');
  archive.finalize();
});

// Default download directory
app.get('/api/default-dir', (req, res) => {
  res.json({ dir: DEFAULT_DOWNLOAD_DIR, allowCustom: ALLOW_CUSTOM_DIR });
});

// scripts/start.sh writes the Cloudflare tunnel's https address here. A free
// quick tunnel gets a new address every restart, so read it per request rather
// than caching it at boot.
const TUNNEL_URL_FILE = path.join(__dirname, '.tunnel-url');

function tunnelUrl() {
  try { return fs.readFileSync(TUNNEL_URL_FILE, 'utf8').trim(); } catch { return ''; }
}

// What this instance can and cannot do. The web UI and the extension both use
// it to hide desktop-only actions when the server is hosted somewhere else.
app.get('/api/config', (req, res) => {
  res.json({
    mode: MODE,
    serverMode: SERVER_MODE,
    platform: process.platform,
    downloadDir: DEFAULT_DOWNLOAD_DIR,
    allowCustomDir: ALLOW_CUSTOM_DIR,
    canOpenFolder: ALLOW_OPEN_FOLDER,
    servesFiles: true,
    retentionMinutes: RETENTION_MIN,
    ffmpeg: !!FFMPEG_PATH,
    auth: !!TOKEN,
    isOwner: !!(req.mfAuth && req.mfAuth.admin),
    user: (req.mfAuth && req.mfAuth.name) || '',
    publicUrl: PUBLIC_URL,
    tunnelUrl: tunnelUrl(),
    version: cachedYtDlpVersion,
  });
});

// Thumbnail proxy — TikTok/Instagram CORS workaround
app.get('/api/thumb', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  let target;
  try { target = new URL(url); } catch { return res.status(400).end(); }

  // Only http/https, block private/loopback/link-local/metadata ranges (SSRF).
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return res.status(400).end();
  const host = target.hostname.toLowerCase();
  const isPrivateV4 = /^(0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host);
  const isPrivateV6 = host.includes(':') && /^(::1$|::ffff:|fc|fd|fe80)/.test(host);
  if (host === 'localhost' || host.endsWith('.localhost') || isPrivateV4 || isPrivateV6) {
    return res.status(400).end();
  }

  const https = require('https');
  const http2 = require('http');
  const client = target.protocol === 'https:' ? https : http2;
  const request = client.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': `${target.protocol}//${target.hostname}/`
    },
    timeout: 8000
  }, (upstream) => {
    if (upstream.statusCode >= 400) { res.status(502).end(); return; }
    // Only proxy actual images — never an HTML/redirect body.
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    if (ct && !ct.startsWith('image/')) { upstream.resume(); res.status(502).end(); return; }
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
  });
  request.on('timeout', () => request.destroy());
  request.on('error', () => { if (!res.headersSent) res.status(502).end(); });
});

// ── Key management (owner only) ──────────────────────
function ownerOnly(req, res, next) {
  if (!TOKEN) return res.status(409).json({ error: 'Key management needs MEDIAFETCH_TOKEN to be set' });
  if (req.mfAuth && req.mfAuth.admin) return next();
  return res.status(403).json({ error: 'Owner key required' });
}

// The key value itself is returned too — the owner has to be able to hand it
// over, and it is already stored in plain text in keys.json beside this process.
const publicKey = (k) => ({
  id: k.id, name: k.name, key: k.key, disabled: !!k.disabled,
  created: k.created, lastUsed: k.lastUsed || '', downloads: k.downloads || 0,
});

app.get('/api/keys', ownerOnly, (req, res) => {
  res.json({ keys: readKeys().map(publicKey) });
});

app.post('/api/keys', ownerOnly, (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'A name is required' });

  const keys = readKeys();
  if (keys.length >= 100) return res.status(409).json({ error: 'Too many keys (100 max)' });

  const entry = {
    id: crypto.randomBytes(6).toString('hex'),
    name,
    key: newKeyValue(),
    created: new Date().toISOString(),
    lastUsed: '',
    downloads: 0,
    disabled: false,
  };
  keys.push(entry);
  if (!saveKeys(keys)) return res.status(500).json({ error: 'Could not save keys.json' });
  res.json({ key: publicKey(entry) });
});

app.post('/api/keys/:id/toggle', ownerOnly, (req, res) => {
  const keys = readKeys();
  const target = keys.find(k => k.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Key not found' });
  target.disabled = !target.disabled;
  if (!saveKeys(keys)) return res.status(500).json({ error: 'Could not save keys.json' });
  res.json({ key: publicKey(target) });
});

app.post('/api/keys/:id/delete', ownerOnly, (req, res) => {
  const keys = readKeys();
  const next = keys.filter(k => k.id !== req.params.id);
  if (next.length === keys.length) return res.status(404).json({ error: 'Key not found' });
  if (!saveKeys(next)) return res.status(500).json({ error: 'Could not save keys.json' });
  res.json({ ok: true });
});

// ffmpeg status
app.get('/api/ffmpeg-status', (req, res) => {
  res.json({ available: !!FFMPEG_PATH, path: FFMPEG_PATH });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.post('/api/settings', (req, res) => {
  const current = readSettings();
  const updated = { ...current, ...req.body };
  saveSettings(updated);
  res.json(updated);
});

// Check for updates (read-only — no download)
app.get('/api/check-updates', async (req, res) => {
  try {
    const release = await fetchLatestRelease();
    const latest = release.tag_name;
    const current = cachedYtDlpVersion;
    res.json({
      current,
      latest,
      updateAvailable: !!(current && latest && current !== latest)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Video info
app.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  // Only allow http/https URLs
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are supported' });
  }

  if (!fs.existsSync(YT_DLP)) {
    return res.status(500).json({ error: 'yt-dlp not installed. Run node setup.js first.' });
  }

  const args = ['--dump-json', '--no-playlist', ...getPlatformArgs(url), url];
  let output = '';
  let errOutput = '';

  const proc = spawn(YT_DLP, args);
  let sent = false;
  const respond = (fn) => { if (sent) return; sent = true; clearTimeout(timer); fn(); };

  // Kill a hung probe instead of leaving the request (and process) stuck.
  const timer = setTimeout(() => {
    try { proc.kill(); } catch {}
    respond(() => res.status(408).json({ error: 'Video info request timed out.' }));
  }, 45000);

  proc.stdout.on('data', (d) => { output += d.toString(); });
  proc.stderr.on('data', (d) => { errOutput += d.toString(); });

  proc.on('error', (err) => {
    respond(() => res.status(500).json({ error: 'Could not run yt-dlp.', detail: err.message }));
  });

  proc.on('close', (code) => {
    respond(() => {
      if (code !== 0) {
        return res.status(400).json({ error: 'Could not fetch video info. Check the URL.', detail: errOutput });
      }
      try {
        const info = JSON.parse(output);
        res.json({
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          uploader: info.uploader || info.channel || '',
          formats: extractFormats(info)
        });
      } catch {
        res.status(500).json({ error: 'Failed to parse video info.' });
      }
    });
  });
});

function extractFormats(info) {
  const formats = [];
  formats.push({ id: 'mp3-320', label: 'MP3 - 320kbps', type: 'audio' });
  formats.push({ id: 'mp3-192', label: 'MP3 - 192kbps', type: 'audio' });
  formats.push({ id: 'mp3-128', label: 'MP3 - 128kbps', type: 'audio' });

  const videoQualities = [
    { height: 2160, label: '4K (2160p)' },
    { height: 1440, label: '2K (1440p)' },
    { height: 1080, label: '1080p HD' },
    { height: 720,  label: '720p HD' },
    { height: 480,  label: '480p' },
    { height: 360,  label: '360p' },
  ];

  const availableHeights = new Set(
    (info.formats || [])
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
      .map(f => f.height)
  );

  for (const q of videoQualities) {
    const available = availableHeights.size === 0 || [...availableHeights].some(h => h >= q.height);
    if (available || q.height <= 720) {
      formats.push({ id: `mp4-${q.height}`, label: `MP4 - ${q.label}`, type: 'video', height: q.height });
    }
  }
  return formats;
}

// Active downloads
const downloads = new Map();

// Who started which download, so the history says who fetched what.
const downloadOwner = new Map();   // downloadId -> display name
const ownerOf = (id) => downloadOwner.get(id) || downloadOwner.get(String(id).replace(/_[va]$/, '')) || '';

// ── Finished files ─────────────────────────────
// A hosted instance downloads onto the server's disk, so the client has to be
// able to pull the result back down. Completed downloads are registered here and
// served by id: the path never comes from the request, so there is nothing for a
// caller to traverse.
const finishedFiles = new Map();   // downloadId -> { file, name, at }
const FINISHED_MAX = 300;

function registerFinished(downloadId, file) {
  if (!downloadId || !file) return '';
  let abs;
  try { abs = path.resolve(String(file).trim()); } catch { return ''; }
  if (!fs.existsSync(abs)) return '';
  try { if (!fs.statSync(abs).isFile()) return ''; } catch { return ''; }
  finishedFiles.set(downloadId, { file: abs, name: path.basename(abs), at: Date.now() });
  while (finishedFiles.size > FINISHED_MAX) {
    finishedFiles.delete(finishedFiles.keys().next().value);
  }
  return path.basename(abs);
}

const fileUrlFor = (id) => `/api/file/${encodeURIComponent(id)}`;

function completionPayload(downloadId, fallbackName) {
  const entry = finishedFiles.get(downloadId);
  return {
    type: 'complete',
    downloadId,
    filename: (entry && entry.name) || fallbackName || '',
    fileUrl: entry ? fileUrlFor(downloadId) : '',
    size: entry ? (() => { try { return fs.statSync(entry.file).size; } catch { return 0; } })() : 0,
  };
}

// Stream a finished file to the client (the only way to get it off a hosted box).
app.get('/api/file/:id', (req, res) => {
  const entry = finishedFiles.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'File not available — unknown or expired download id' });
  }
  if (!fs.existsSync(entry.file)) {
    finishedFiles.delete(req.params.id);
    return res.status(410).json({ error: 'File is no longer on the server' });
  }
  // Latin-1 fallback plus RFC 5987 form, so unicode titles survive the header.
  const ascii = entry.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(entry.name)}`);
  const fileToDelete = entry.file;
  res.sendFile(fileToDelete, (err) => {
    if (err && !res.headersSent) res.status(500).end();
    // Delete from disk and registry as soon as the transfer completes.
    // Nothing stays on Ubuntu after the browser has the file.
    finishedFiles.delete(req.params.id);
    try { fs.unlinkSync(fileToDelete); } catch {}
  });
});

// WebSocket clients
const wsClients = new Set();
wss.on('connection', (ws, req) => {
  if (TOKEN) {
    let given = '';
    try {
      const u = new URL(req.url || '/', 'http://localhost');
      given = u.searchParams.get('token') || u.searchParams.get('t') || '';
    } catch {}
    if (!given) given = tokenFromCookie(req.headers.cookie);
    if (!identify(given)) {
      try { ws.close(4401, 'Unauthorized'); } catch {}
      return;
    }
  }
  wsClients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => wsClients.delete(ws));
});

// Reverse proxies drop idle upgrades (nginx: 60s by default). Ping often enough
// that a connection waiting on a long download survives.
setInterval(() => {
  for (const ws of wsClients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 25000).unref();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function startProc(downloadId, args, historyMeta) {
  const proc = spawn(YT_DLP, args);
  downloads.set(downloadId, { proc });
  broadcast({ type: 'start', downloadId });

  let buffer = '';
  let capturedFilename = '';
  let finalPath = '';

  // yt-dlp names the file it is writing more than once: once per stream, then
  // again after a merge, an audio extraction or a move. The last name is the one
  // the user actually gets, and it is the file offered back over HTTP.
  const noteOutput = (line) => {
    let m;
    if ((m = line.match(/^\[Merger\] Merging formats into "(.+)"$/))) { finalPath = m[1]; return; }
    if ((m = line.match(/^\[MoveFiles\] Moving file "(.+)" to "(.+)"$/))) { finalPath = m[2]; return; }
    if ((m = line.match(/Destination:\s*(.+)$/))) { finalPath = m[1].trim(); return; }
    if ((m = line.match(/^\[download\] (.+) has already been downloaded$/))) { finalPath = m[1].trim(); }
  };

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    // yt-dlp emits progress updates terminated with \r (not \n); split on both
    // so the progress bar updates live instead of only at end-of-line.
    const lines = buffer.split(/\r\n|[\r\n]/);
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      noteOutput(trimmed);
      const destM = trimmed.match(/\[download\] Destination: (.+)/);
      if (destM) capturedFilename = path.basename(destM[1]);
      parseProgress(trimmed, downloadId);
    }
  });
  proc.stderr.on('data', (data) => {
    parseProgress(data.toString().trim(), downloadId);
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      downloads.delete(downloadId);
      if (code === 0) {
        const name = registerFinished(downloadId, finalPath) || capturedFilename;
        broadcast(completionPayload(downloadId, name));
        if (historyMeta) {
          appendHistory({
            url: historyMeta.url, title: historyMeta.title || name,
            filename: name, user: ownerOf(downloadId),
          });
        }
      } else {
        broadcast({ type: 'error', downloadId, message: 'Download failed.' });
      }
      resolve(code);
    });
    proc.on('error', (err) => {
      downloads.delete(downloadId);
      broadcast({ type: 'error', downloadId, message: 'Error: ' + err.message });
      resolve(-1);
    });
  });
}

// Start download
app.post('/api/download', (req, res) => {
  const { url, formatId, outputDir, separateAudio } = req.body;
  if (!url || !formatId) return res.status(400).json({ error: 'URL and format required' });

  // Whitelist the format id — guarantees quality/height are always valid values
  // and keeps unexpected strings from reaching the downloader.
  if (!/^(mp3-(320|192|128)|mp4-(2160|1440|1080|720|480|360))$/.test(formatId)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  // outputDir is a user-chosen folder (any absolute path is allowed by design);
  // only reject clearly malformed values (non-string / NUL byte).
  if (outputDir != null && (typeof outputDir !== 'string' || outputDir.includes('\0'))) {
    return res.status(400).json({ error: 'Invalid output directory' });
  }

  // Only allow http/https URLs
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are supported' });
  }

  if (!fs.existsSync(YT_DLP)) {
    return res.status(500).json({ error: 'yt-dlp not installed.' });
  }

  // Local mode lets the user save anywhere on their own machine. A hosted
  // instance ignores the request's folder entirely — the caller is remote and
  // must not be able to pick a write path on the server.
  const downloadDir = (ALLOW_CUSTOM_DIR && typeof outputDir === 'string' && outputDir.trim())
    ? path.resolve(outputDir.trim())
    : DEFAULT_DOWNLOAD_DIR;
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Remember who asked, for the history and the per-key counter.
  downloadOwner.set(downloadId, (req.mfAuth && req.mfAuth.name) || '');
  while (downloadOwner.size > 200) downloadOwner.delete(downloadOwner.keys().next().value);
  if (req.mfAuth && req.mfAuth.id) countKeyDownload(req.mfAuth.id);

  const isAudio = formatId.startsWith('mp3');
  const quality = formatId.split('-')[1];
  const height = formatId.split('-')[1];
  const hasFfmpeg = !!FFMPEG_PATH;
  const ffmpegArgs = hasFfmpeg ? ['--ffmpeg-location', FFMPEG_PATH] : [];
  const platformArgs = getPlatformArgs(url);
  const isTikTok = url.toLowerCase().includes('tiktok.com');
  const isPlaylist = !isTikTok && (url.includes('list=') || url.includes('/playlist') || url.includes('/sets/'));
  const tikEmbedUrl = isTikTok ? toTikTokEmbedUrl(url) : null;

  if (isAudio) {
    const srcUrl = tikEmbedUrl || url;
    const args = [
      ...(tikEmbedUrl ? ['--playlist-items', '1'] : isPlaylist ? ['--yes-playlist'] : ['--no-playlist']),
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', quality === '320' ? '0' : quality === '192' ? '5' : '7',
      ...ffmpegArgs,
      ...(tikEmbedUrl ? [] : platformArgs),
      '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
      '--progress', srcUrl
    ];
    res.json({ downloadId });
    startProc(downloadId, args, { url });

  } else if (separateAudio) {
    const videoId = downloadId + '_v';
    const audioId = downloadId + '_a';
    res.json({ downloadId: videoId, audioDownloadId: audioId });

    if (tikEmbedUrl) {
      getTikTokTitle(url, platformArgs).then((title) => {
        const vTpl = title
          ? path.join(downloadDir, `${title} [Video].mp4`)
          : path.join(downloadDir, '%(title)s [Video].mp4');
        const aTpl = title
          ? path.join(downloadDir, `${title} [Audio].%(ext)s`)
          : path.join(downloadDir, '%(title)s [Audio].%(ext)s');
        startProc(videoId, ['--playlist-items', '1', '--remux-video', 'mp4', '--merge-output-format', 'mp4', ...ffmpegArgs, '-o', vTpl, '--progress', tikEmbedUrl], { url, title });
        startProc(audioId, ['--playlist-items', '1', '-x', '--audio-format', hasFfmpeg ? 'wav' : 'm4a', ...ffmpegArgs, '-o', aTpl, '--progress', tikEmbedUrl], { url, title });
      });

    } else if (hasFfmpeg) {
      startProc(videoId, [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', `bestvideo[height<=${height}][ext=mp4][vcodec^=avc]/bestvideo[height<=${height}][ext=mp4]/bestvideo[height<=${height}][vcodec^=avc]/bestvideo[height<=${height}]`,
        ...platformArgs, '-o', path.join(downloadDir, '%(title)s [Video].%(ext)s'), '--progress', url
      ], { url });
      startProc(audioId, [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', 'bestaudio/best', '-x', '--audio-format', 'wav', ...ffmpegArgs,
        ...platformArgs, '-o', path.join(downloadDir, '%(title)s [Audio].%(ext)s'), '--progress', url
      ], { url });

    } else {
      startProc(videoId, [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', `best[height<=${height}][ext=mp4]/best[height<=${height}]/best`,
        ...platformArgs, '-o', path.join(downloadDir, '%(title)s [Video].%(ext)s'), '--progress', url
      ], { url });
      startProc(audioId, [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        ...platformArgs, '-o', path.join(downloadDir, '%(title)s [Audio].%(ext)s'), '--progress', url
      ], { url });
    }

  } else {
    let fmt;
    if (isTikTok) {
      if (tikEmbedUrl && hasFfmpeg) {
        res.json({ downloadId });
        runTikTokWatermarkFree(downloadId, url, tikEmbedUrl, platformArgs, ffmpegArgs, downloadDir, height);
        return;
      } else if (tikEmbedUrl) {
        // Embed id known but no ffmpeg to remux — hand off to the yt-dlp
        // fallback, which honors the requested height and is watermark-free.
        res.json({ downloadId });
        startTikTokFallback(downloadId, url, platformArgs, ffmpegArgs, downloadDir, height);
        return;
      }
      // Short/canonical URL with no extractable embed id: resolution-aware
      // yt-dlp selector (also honors the requested height).
      fmt = tiktokVideoFormat(height);
    } else if (hasFfmpeg) {
      fmt = [
        `bestvideo[height<=${height}][ext=mp4][vcodec^=avc]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${height}][ext=mp4][vcodec^=avc]+bestaudio`,
        `bestvideo[height<=${height}][vcodec^=avc]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${height}][vcodec^=avc]+bestaudio`,
        `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${height}]+bestaudio`,
        `best[height<=${height}][ext=mp4]`,
        `best[height<=${height}]`,
        'best'
      ].join('/');
    } else {
      fmt = `best[height<=${height}][ext=mp4][vcodec^=avc]/best[height<=${height}][ext=mp4]/best[height<=${height}]/best`;
    }

    const args = [
      isPlaylist ? '--yes-playlist' : '--no-playlist',
      '-f', fmt,
      '--merge-output-format', 'mp4',
      ...ffmpegArgs, ...platformArgs,
      '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
      '--progress', url
    ];
    res.json({ downloadId });
    startProc(downloadId, args, { url });
  }
});

function parseProgress(line, downloadId) {
  const plMatch = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
  if (plMatch) {
    broadcast({ type: 'status', downloadId, message: `Playlist: ${plMatch[1]} / ${plMatch[2]}` });
    return;
  }
  const dlMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)\s+ETA\s+(\S+)/);
  if (dlMatch) {
    broadcast({ type: 'progress', downloadId, percent: parseFloat(dlMatch[1]), size: dlMatch[2], speed: dlMatch[3], eta: dlMatch[4] });
    return;
  }
  const destMatch = line.match(/\[download\] Destination: (.+)/);
  if (destMatch) {
    broadcast({ type: 'filename', downloadId, filename: path.basename(destMatch[1]) });
    return;
  }
  if (line.includes('[Merger]') || line.includes('Merging')) {
    broadcast({ type: 'status', downloadId, message: 'Merging...' });
    return;
  }
  if (line.includes('[ExtractAudio]') || line.includes('Extracting audio')) {
    broadcast({ type: 'status', downloadId, message: 'Extracting audio...' });
    return;
  }
}

// Download history
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.post('/api/history/clear', (req, res) => {
  try { fs.writeFileSync(HISTORY_FILE, '[]'); } catch {}
  res.json({ ok: true });
});

// yt-dlp version
app.get('/api/ytdlp-version', (req, res) => {
  res.json({ version: cachedYtDlpVersion });
});

// Playlist info
app.post('/api/playlist-info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const args = ['--flat-playlist', '--dump-single-json', '--playlist-items', '1', ...getPlatformArgs(url), url];
  let output = '';
  let sent = false;

  const proc = spawn(YT_DLP, args);
  proc.stdout.on('data', d => { output += d.toString(); });

  const timer = setTimeout(() => {
    try { proc.kill(); } catch {}
    if (!sent) { sent = true; res.status(408).json({ error: 'Timeout' }); }
  }, 25000);

  proc.on('close', () => {
    clearTimeout(timer);
    if (sent) return;
    sent = true;
    try {
      const info = JSON.parse(output);
      res.json({
        title: info.title || info.playlist_title || 'Playlist',
        count: info.playlist_count || (Array.isArray(info.entries) ? info.entries.length : 0)
      });
    } catch {
      res.status(400).json({ error: 'Failed to fetch playlist info.' });
    }
  });

  proc.on('error', () => {
    clearTimeout(timer);
    if (!sent) { sent = true; res.status(500).json({ error: 'Error' }); }
  });
});

// Cancel download
app.post('/api/cancel/:id', (req, res) => {
  const dl = downloads.get(req.params.id);
  if (dl) {
    dl.proc.kill();
    downloads.delete(req.params.id);
    broadcast({ type: 'cancelled', downloadId: req.params.id });
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Download not found' });
  }
});

// Reveal a folder in the desktop file manager — spawn (not exec) so nothing is
// passed through a shell. Meaningless on a hosted instance, where the client
// fetches finished files over HTTP instead.
function openPath(target) {
  const cmd = IS_WIN ? 'explorer' : IS_MAC ? 'open' : 'xdg-open';
  try {
    const child = spawn(cmd, [target], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {}
}

app.post('/api/open-folder', (req, res) => {
  if (!ALLOW_OPEN_FOLDER) {
    return res.status(409).json({ error: 'Not available on a hosted instance — use the download button.' });
  }
  const { dir } = req.body || {};
  const ok = typeof dir === 'string' && dir && !dir.includes('\0') && fs.existsSync(dir);
  openPath(ok ? dir : DEFAULT_DOWNLOAD_DIR);
  res.json({ ok: true });
});

// yt-dlp update — downloads directly from official GitHub release with SHA256 verification
app.post('/api/update-ytdlp', (req, res) => {
  res.json({ ok: true });
  performUpdate().catch(err => {
    broadcast({ type: 'update-log', message: `\nError: ${err.message}\n` });
    broadcast({ type: 'update-error', message: err.message });
    try { if (fs.existsSync(YTDLP_TARGET + '.download')) fs.unlinkSync(YTDLP_TARGET + '.download'); } catch {}
  });
});

// ── Retention ────────────────────────────────
// A hosted instance only needs to keep a file long enough for the browser or the
// extension to pull it down; without this a shared box fills up.
function sweepOldFiles() {
  if (!RETENTION_MIN) return;
  const cutoff = Date.now() - RETENTION_MIN * 60 * 1000;
  let removed = 0;
  try {
    for (const name of fs.readdirSync(DEFAULT_DOWNLOAD_DIR)) {
      const f = path.join(DEFAULT_DOWNLOAD_DIR, name);
      try {
        const st = fs.statSync(f);
        if (st.isFile() && st.mtimeMs < cutoff) { fs.unlinkSync(f); removed++; }
      } catch {}
    }
  } catch {}
  for (const [id, entry] of finishedFiles) {
    if (!fs.existsSync(entry.file)) finishedFiles.delete(id);
  }
  if (removed) console.log(`retention: removed ${removed} file(s) older than ${RETENTION_MIN} min`);
}

function openInBrowser(url) {
  if (IS_WIN) {
    // "start" is a cmd builtin; the empty title argument keeps a quoted URL from
    // being treated as the window title.
    const child = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return;
  }
  openPath(url);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠  Port ${PORT} is already in use.`);
    console.error('   Another MediaFetch instance may be running, or something else holds the port.');
    console.error('   Pick a free one with MEDIAFETCH_PORT=<port> (Pterodactyl: SERVER_PORT).\n');
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error(`\n⚠  Not allowed to bind port ${PORT}.`);
    console.error('   Ports below 1024 need root — use a high port and put nginx in front of it.\n');
    process.exit(1);
  } else if (err.code === 'EADDRNOTAVAIL') {
    console.error(`\n⚠  Address ${HOST} does not exist on this machine — check MEDIAFETCH_HOST.\n`);
    process.exit(1);
  } else { throw err; }
});

server.listen(PORT, HOST, () => {
  const shown = PUBLIC_URL || `http://${HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST}:${PORT}`;
  console.log(`\n=== MediaFetch (${MODE}) ===`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Web UI: ${shown}${TOKEN ? '/login?t=<YOUR_TOKEN>' : ''}`);
  if (TOKEN) console.log('Auth: enabled (MEDIAFETCH_TOKEN)');
  if (SERVER_MODE) console.log(`Files are served back over HTTP; kept ${RETENTION_MIN ? RETENTION_MIN + ' min' : 'indefinitely'}.`);
  console.log('Press Ctrl+C to stop\n');

  if (RETENTION_MIN) {
    sweepOldFiles();
    setInterval(sweepOldFiles, 30 * 60 * 1000).unref();
  }

  // Fetch current yt-dlp version, then optionally check for updates
  fetchYtDlpVersion(ver => {
    if (ver) broadcast({ type: 'ytdlp-version', version: ver });

    const settings = readSettings();
    if (settings.autoUpdate) {
      console.log('Auto-update enabled — checking for yt-dlp updates...');
      fetchLatestRelease()
        .then(release => {
          if (release.tag_name && cachedYtDlpVersion && release.tag_name !== cachedYtDlpVersion) {
            console.log(`yt-dlp update available: ${cachedYtDlpVersion} → ${release.tag_name}`);
            broadcast({ type: 'update-available', current: cachedYtDlpVersion, latest: release.tag_name });
          }
        })
        .catch(() => {}); // Silent failure — no internet is normal
    }
  });

  if (AUTO_OPEN_BROWSER) setTimeout(() => openInBrowser(shown), 1000);
});

// Pterodactyl / systemd / docker stop the app with SIGTERM. Kill the downloader
// children first, or yt-dlp keeps running and leaves .part files behind.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down...`);
  for (const [, dl] of downloads) {
    try { dl.proc.kill(); } catch {}
  }
  downloads.clear();
  for (const ws of wsClients) { try { ws.close(1001, 'Server shutting down'); } catch {} }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
