const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn, execFile } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const YT_DLP = path.join(__dirname, 'bin', 'yt-dlp.exe');
const DEFAULT_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads');

// ffmpeg location — version-independent WinGet scan
function findFfmpeg() {
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
  try {
    const { execSync } = require('child_process');
    const found = execSync('where ffmpeg', { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim().split('\n')[0].trim();
    if (found && fs.existsSync(found)) return path.dirname(found);
  } catch {}
  return '';
}

const FFMPEG_PATH = findFfmpeg();
console.log(FFMPEG_PATH ? `ffmpeg found: ${FFMPEG_PATH}` : 'ffmpeg not found — audio/video merge disabled');

// ── Download history ─────────────────────────────────────────
const HISTORY_FILE = path.join(__dirname, 'history.json');

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function appendHistory({ url, title, filename }) {
  const hist = readHistory();
  hist.unshift({ url, title: title || filename || '', filename: filename || '', date: new Date().toISOString() });
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

// ── yt-dlp version ────────────────────────────────────────────
let cachedYtDlpVersion = '';

function fetchYtDlpVersion(cb) {
  if (!fs.existsSync(YT_DLP)) return cb && cb('');
  const p = spawn(YT_DLP, ['--version']);
  let v = '';
  p.stdout.on('data', d => { v += d.toString(); });
  p.on('close', () => { cachedYtDlpVersion = v.trim(); cb && cb(cachedYtDlpVersion); });
  p.on('error', () => cb && cb(''));
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
  const exeAsset = (release.assets || []).find(a => a.name === 'yt-dlp.exe');
  const sumsAsset = (release.assets || []).find(a => a.name === 'SHA2-256SUMS');

  if (!exeAsset || !sumsAsset) {
    throw new Error('Expected assets (yt-dlp.exe, SHA2-256SUMS) not found in GitHub release');
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
  const expectedHash = parseSHA256Sums(sumsContent, 'yt-dlp.exe');
  if (!expectedHash) throw new Error('yt-dlp.exe entry not found in SHA2-256SUMS');

  log(`Expected SHA256:\n  ${expectedHash}\n\n`);

  const sizeMB = exeAsset.size ? `~${(exeAsset.size / 1024 / 1024).toFixed(1)} MB` : '';
  log(`Downloading yt-dlp.exe ${sizeMB}...\n`);
  broadcast({ type: 'update-progress', percent: 0 });

  const tmpPath = YT_DLP + '.download';
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

  // Backup existing binary, replace with new one
  const backupPath = YT_DLP + '.bak';
  if (fs.existsSync(YT_DLP)) {
    try { fs.renameSync(YT_DLP, backupPath); } catch {}
  }
  fs.renameSync(tmpPath, YT_DLP);
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
const NODE_PATH = (() => {
  try {
    const { execSync } = require('child_process');
    const p = execSync('where node', { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim().split('\n')[0].trim();
    return p && fs.existsSync(p) ? p : '';
  } catch { return ''; }
})();
const JS_RUNTIME_ARGS = NODE_PATH ? ['--js-runtimes', `node:${NODE_PATH}`] : [];

// TikTok embed URL
function toTikTokEmbedUrl(url) {
  const match = url.match(/\/video\/(\d+)/);
  if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
  return null;
}

// TikTok watermark-free download
async function runTikTokWatermarkFree(downloadId, url, embedUrl, platformArgs, ffmpegArgs, downloadDir, height) {
  const ffmpegBin = path.join(FFMPEG_PATH, 'ffmpeg.exe');
  const ffprobeBin = path.join(FFMPEG_PATH, 'ffprobe.exe');

  broadcast({ type: 'status', downloadId, message: 'Analyzing TikTok...' });

  const embedPageData = await new Promise((resolve) => {
    const https = require('https');
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };
    https.get(embedUrl, opts, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
    setTimeout(() => resolve(''), 12000);
  });

  if (!embedPageData) {
    broadcast({ type: 'error', downloadId, message: 'Embed page failed to load.' });
    return;
  }

  const html = embedPageData
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, '&');

  const videoSrcMatch = html.match(/<video[^>]+src="(https:\/\/[^"]+tiktokcdn[^"]+)"/);
  if (!videoSrcMatch) {
    broadcast({ type: 'status', downloadId, message: 'Downloading via embed URL...' });
    const title = await getTikTokTitle(url, platformArgs);
    const safeName = (title || `tiktok_${downloadId}`).replace(/[\\/:*?"<>|]/g, '_');
    const outTpl = path.join(downloadDir, `${safeName}.mp4`);
    const args = ['--playlist-items', '1', '--remux-video', 'mp4', '--merge-output-format', 'mp4',
      ...ffmpegArgs, '-o', outTpl, '--progress', embedUrl];
    startProc(downloadId, args, { url, title: safeName });
    return;
  }

  const playUrl = videoSrcMatch[1];
  const titleMatch = html.match(/"desc"\s*:\s*"([^"]+)"/);
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
  const videoDownloaded = await new Promise((resolve) => {
    const https = require('https');
    const fileStream = fs.createWriteStream(tmpRaw);

    function doGet(dlUrl, depth) {
      if (depth > 5) { resolve(false); return; }
      https.get(dlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Range': 'bytes=0-',
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location, depth + 1);
          return;
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          resolve(false); return;
        }
        contentLength = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (contentLength > 0) {
            broadcast({ type: 'progress', downloadId, percent: Math.round((downloaded / contentLength) * 75) });
          }
        });
        res.pipe(fileStream);
        res.on('end', () => { fileStream.end(); resolve(true); });
        res.on('error', () => resolve(false));
      }).on('error', () => resolve(false));
    }
    doGet(playUrl, 0);

    downloads.set(downloadId, {
      proc: { kill: () => { fileStream.destroy(); resolve(false); } }
    });
  });

  if (!videoDownloaded || !fs.existsSync(tmpRaw)) {
    try { fs.unlinkSync(tmpRaw); } catch {}
    broadcast({ type: 'error', downloadId, message: 'Video download failed.' });
    downloads.delete(downloadId);
    return;
  }

  broadcast({ type: 'progress', downloadId, percent: 77 });
  broadcast({ type: 'status', downloadId, message: 'Removing watermark...' });

  const probeOut = await new Promise((resolve) => {
    execFile(ffprobeBin, [
      '-v', 'quiet', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0', tmpRaw
    ], (err, stdout) => {
      if (err || !stdout.trim()) { resolve(null); return; }
      const parts = stdout.trim().split(',');
      resolve({ w: parseInt(parts[0], 10), h: parseInt(parts[1], 10) });
    });
  });

  let delogoFilter = '';
  if (probeOut && probeOut.w && probeOut.h) {
    const lx = Math.round(probeOut.w * 0.65);
    const ly = Math.round(probeOut.h * 0.86);
    const lw = probeOut.w - lx - 2;
    const lh = probeOut.h - ly - 2;
    delogoFilter = `delogo=x=${lx}:y=${ly}:w=${lw}:h=${lh}`;
  }

  const ffmpegDelogoArgs = delogoFilter
    ? ['-i', tmpRaw, '-vf', delogoFilter, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'copy', '-y', finalOut]
    : ['-i', tmpRaw, '-c', 'copy', '-y', finalOut];

  await new Promise((resolve) => {
    const proc = spawn(ffmpegBin, ffmpegDelogoArgs);
    downloads.set(downloadId, { proc });
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      const m = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && probeOut) {
        const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        const pct = Math.min(97, 77 + Math.round(secs * 20 / 30));
        broadcast({ type: 'progress', downloadId, percent: pct });
      }
    });
    proc.on('close', resolve);
    proc.on('error', resolve);
  });

  try { fs.unlinkSync(tmpRaw); } catch {}
  downloads.delete(downloadId);

  if (fs.existsSync(finalOut)) {
    broadcast({ type: 'progress', downloadId, percent: 100 });
    broadcast({ type: 'complete', downloadId });
    appendHistory({ url, title: safeName, filename: `${safeName}.mp4` });
  } else {
    broadcast({ type: 'error', downloadId, message: 'Watermark removal failed.' });
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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// CORS — Brave/Chrome extension only
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (origin.startsWith('chrome-extension://') || origin.startsWith('brave-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Default download directory
app.get('/api/default-dir', (req, res) => {
  res.json({ dir: DEFAULT_DOWNLOAD_DIR });
});

// Thumbnail proxy — TikTok/Instagram CORS workaround
app.get('/api/thumb', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  let target;
  try { target = new URL(url); } catch { return res.status(400).end(); }

  // Only http/https, block private/loopback ranges
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return res.status(400).end();
  const host = target.hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/.test(host)) {
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
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
  });
  request.on('error', () => res.status(502).end());
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
  proc.stdout.on('data', (d) => { output += d.toString(); });
  proc.stderr.on('data', (d) => { errOutput += d.toString(); });

  proc.on('close', (code) => {
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

// WebSocket clients
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

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

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
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
        broadcast({ type: 'complete', downloadId });
        if (historyMeta) appendHistory({ url: historyMeta.url, title: historyMeta.title || capturedFilename, filename: capturedFilename });
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

  // Only allow http/https URLs
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are supported' });
  }

  if (!fs.existsSync(YT_DLP)) {
    return res.status(500).json({ error: 'yt-dlp not installed.' });
  }

  const downloadDir = outputDir || DEFAULT_DOWNLOAD_DIR;
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadId = Date.now().toString();
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
        res.json({ downloadId });
        getTikTokTitle(url, platformArgs).then((title) => {
          const outTpl = title
            ? path.join(downloadDir, `${title}.mp4`)
            : path.join(downloadDir, '%(title)s.mp4');
          startProc(downloadId, ['--playlist-items', '1', '--remux-video', 'mp4', '--merge-output-format', 'mp4', '-o', outTpl, '--progress', tikEmbedUrl], { url, title });
        });
        return;
      }
      fmt = `best[ext=mp4][acodec!=none]/best[acodec!=none]/best`;
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

// Open folder in Explorer — use spawn (not exec) to avoid command injection
app.post('/api/open-folder', (req, res) => {
  const { dir } = req.body;
  const target = (dir && fs.existsSync(dir)) ? dir : DEFAULT_DOWNLOAD_DIR;
  spawn('explorer', [target]);
  res.json({ ok: true });
});

// yt-dlp update — downloads directly from official GitHub release with SHA256 verification
app.post('/api/update-ytdlp', (req, res) => {
  res.json({ ok: true });
  performUpdate().catch(err => {
    broadcast({ type: 'update-log', message: `\nError: ${err.message}\n` });
    broadcast({ type: 'update-error', message: err.message });
    try { if (fs.existsSync(YT_DLP + '.download')) fs.unlinkSync(YT_DLP + '.download'); } catch {}
  });
});

const PORT = 3434;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠  Port ${PORT} is already in use.`);
    console.error(`   Another MediaFetch window may be open.`);
    console.error(`   Close it and try again.\n`);
    process.exit(1);
  } else { throw err; }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n=== MediaFetch ===`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop\n');

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

  const { exec } = require('child_process');
  setTimeout(() => exec(`start http://localhost:${PORT}`), 1000);
});
