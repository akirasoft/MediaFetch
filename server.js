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

// ffmpeg konumunu bul — versiyon bağımsız WinGet taraması
function findFfmpeg() {
  // WinGet paket klasörünü tara (versiyon adı değişse bile bulur)
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
  // Bilinen sabit yollar
  for (const c of [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
  ]) {
    if (fs.existsSync(c)) return path.dirname(c);
  }
  // PATH'ten bul
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

// ── İndirme geçmişi ──────────────────────────────────────────
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

// ── Otomatik yt-dlp güncelleme ───────────────────────────────
let cachedYtDlpVersion = '';

function fetchYtDlpVersion(cb) {
  if (!fs.existsSync(YT_DLP)) return cb && cb('');
  const p = spawn(YT_DLP, ['--version']);
  let v = '';
  p.stdout.on('data', d => { v += d.toString(); });
  p.on('close', () => {
    cachedYtDlpVersion = v.trim();
    cb && cb(cachedYtDlpVersion);
  });
  p.on('error', () => cb && cb(''));
}

function autoUpdateYtDlp() {
  if (!fs.existsSync(YT_DLP)) return;
  // Mevcut versiyonu önce önbelleğe al
  fetchYtDlpVersion(() => {
    console.log('Checking for yt-dlp update...');
    const proc = spawn(YT_DLP, ['-U']);
    proc.stdout.on('data', d => console.log('[yt-dlp]', d.toString().trim()));
    proc.on('close', () => {
      fetchYtDlpVersion(ver => {
        if (ver) broadcast({ type: 'ytdlp-version', version: ver });
      });
    });
    proc.on('error', () => {});
  });
}

// Node.js JS runtime argümanı — YouTube format çözümü için
const NODE_PATH = (() => {
  try {
    const { execSync } = require('child_process');
    const p = execSync('where node', { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim().split('\n')[0].trim();
    return p && fs.existsSync(p) ? p : '';
  } catch { return ''; }
})();
const JS_RUNTIME_ARGS = NODE_PATH ? ['--js-runtimes', `node:${NODE_PATH}`] : [];

// TikTok URL'ini embed URL'e çevir — embed formatı ses+video birlikte veriyor
function toTikTokEmbedUrl(url) {
  const match = url.match(/\/video\/(\d+)/);
  if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
  return null;
}

// TikTok filigransız indirme:
// Embed sayfasından <video src> URL'ini çıkar → direkt indir → delogo ile filigran alanı bulanıklaştır
async function runTikTokWatermarkFree(downloadId, url, embedUrl, platformArgs, ffmpegArgs, downloadDir, height) {
  const ffmpegBin = path.join(FFMPEG_PATH, 'ffmpeg.exe');
  const ffprobeBin = path.join(FFMPEG_PATH, 'ffprobe.exe');

  broadcast({ type: 'status', downloadId, message: 'Analyzing TikTok...' });

  // ── 1. Embed sayfasından play URL ve başlık al ─────────────
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

  // Unicode ve HTML entity decode
  const html = embedPageData
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, '&');

  // <video ... src="..."> — embed player'ın kullandığı oynatma URL'i
  const videoSrcMatch = html.match(/<video[^>]+src="(https:\/\/[^"]+tiktokcdn[^"]+)"/);
  if (!videoSrcMatch) {
    // Fallback: embed URL ile yt-dlp
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

  // Başlık — JSON'dan veya yt-dlp'den
  const titleMatch = html.match(/"desc"\s*:\s*"([^"]+)"/);
  const rawTitle = titleMatch ? titleMatch[1] : '';
  const titleFromPage = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
  const title = titleFromPage || (await getTikTokTitle(url, platformArgs)) || `tiktok_${downloadId}`;
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200);

  const tmpRaw = path.join(downloadDir, `_ttraw_${downloadId}.mp4`);
  const finalOut = path.join(downloadDir, `${safeName}.mp4`);

  broadcast({ type: 'filename', downloadId, filename: `${safeName}.mp4` });
  broadcast({ type: 'status', downloadId, message: 'Downloading video...' });

  // ── 2. Play URL'den direkt indir (ses+video birlikte) ─────
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

    // İptal desteği: downloads map'e sahte proc ekle
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

  // ── 3. Video boyutunu al (delogo koordinatları için) ───────
  broadcast({ type: 'status', downloadId, message: 'Removing watermark...' });

  const probeOut = await new Promise((resolve) => {
    const { execFile } = require('child_process');
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
    // TikTok filigranı sağ-alt köşede (~%65-%100 x, %86-%100 y)
    // Kenarlardan 2px boşluk bırak — tam sınırda delogo çalışmıyor
    const lx = Math.round(probeOut.w * 0.65);
    const ly = Math.round(probeOut.h * 0.86);
    const lw = probeOut.w - lx - 2;
    const lh = probeOut.h - ly - 2;
    delogoFilter = `delogo=x=${lx}:y=${ly}:w=${lw}:h=${lh}`;
  }

  // ── 4. ffmpeg ile delogo uygula ────────────────────────────
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
        // ffprobe ile süreyi bilemeyiz ama yaklaşık hesapla
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

// TikTok orijinal URL'den başlık al (embed URL'in başlığı "TikTok Embed" olur)
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

// Platforma göre ekstra yt-dlp argümanları
function getPlatformArgs(url) {
  const u = url.toLowerCase();
  const args = [];

  if (u.includes('tiktok.com')) {
    // TikTok: JS runtime EKLEME (YouTube'a özel), sadece impersonate
    args.push('--impersonate', 'chrome');
    args.push('--add-header', 'Referer:https://www.tiktok.com/');
  } else if (u.includes('instagram.com')) {
    args.push('--add-header', 'Referer:https://www.instagram.com/');
    args.push(...JS_RUNTIME_ARGS);
  } else if (u.includes('twitter.com') || u.includes('x.com')) {
    args.push('--impersonate', 'chrome');
    args.push(...JS_RUNTIME_ARGS);
  } else {
    // YouTube ve diğerleri: JS runtime ekle
    args.push(...JS_RUNTIME_ARGS);
  }

  return args;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Brave/Chrome extension CORS
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

// İndirme klasörü API
app.get('/api/default-dir', (req, res) => {
  res.json({ dir: DEFAULT_DOWNLOAD_DIR });
});

// Thumbnail proxy (TikTok/Instagram CORS sorununu çözer)
app.get('/api/thumb', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  try {
    const https = require('https');
    const http2 = require('http');
    const target = new URL(url);
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
  } catch {
    res.status(400).end();
  }
});

// ffmpeg durumu
app.get('/api/ffmpeg-status', (req, res) => {
  res.json({ available: !!FFMPEG_PATH, path: FFMPEG_PATH });
});

// Video bilgisi al
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

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
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse video info.' });
    }
  });
});

function extractFormats(info) {
  const formats = [];
  // Ses formatları
  formats.push({ id: 'mp3-320', label: 'MP3 - 320kbps', type: 'audio' });
  formats.push({ id: 'mp3-192', label: 'MP3 - 192kbps', type: 'audio' });
  formats.push({ id: 'mp3-128', label: 'MP3 - 128kbps', type: 'audio' });

  // Video formatları
  const videoQualities = [
    { height: 2160, label: '4K (2160p)' },
    { height: 1440, label: '2K (1440p)' },
    { height: 1080, label: '1080p HD' },
    { height: 720, label: '720p HD' },
    { height: 480, label: '480p' },
    { height: 360, label: '360p' },
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

// Aktif indirmeler
const downloads = new Map();

// WebSocket bağlantıları
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

function startProc(downloadId, args, historyMeta = null) {
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

// İndirme başlat
app.post('/api/download', (req, res) => {
  const { url, formatId, outputDir, separateAudio } = req.body;
  if (!url || !formatId) return res.status(400).json({ error: 'URL and format required' });

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
  // TikTok embed URL — ses+video birlikte geliyor (normal URL'de ses yok)
  const tikEmbedUrl = isTikTok ? toTikTokEmbedUrl(url) : null;

  if (isAudio) {
    // ── MP3 indirme ──────────────────────────────────────────────
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
    // ── Editör modu: video + ses ayrı dosyalar ───────────────────
    const videoId = downloadId + '_v';
    const audioId = downloadId + '_a';
    res.json({ downloadId: videoId, audioDownloadId: audioId });

    if (tikEmbedUrl) {
      // TikTok editör modu: başlığı al, embed URL'den video+ses ayrı indir
      getTikTokTitle(url, platformArgs).then((title) => {
        const vTpl = title
          ? path.join(downloadDir, `${title} [Video].mp4`)
          : path.join(downloadDir, '%(title)s [Video].mp4');
        const aTpl = title
          ? path.join(downloadDir, `${title} [Ses].%(ext)s`)
          : path.join(downloadDir, '%(title)s [Ses].%(ext)s');
        const videoArgs = [
          '--playlist-items', '1',
          '--remux-video', 'mp4',
          '--merge-output-format', 'mp4',
          ...ffmpegArgs,
          '-o', vTpl,
          '--progress', tikEmbedUrl
        ];
        const audioArgs = [
          '--playlist-items', '1',
          '-x', '--audio-format', hasFfmpeg ? 'wav' : 'm4a',
          ...ffmpegArgs,
          '-o', aTpl,
          '--progress', tikEmbedUrl
        ];
        startProc(videoId, videoArgs, { url, title });
        startProc(audioId, audioArgs, { url, title });
      });

    } else if (hasFfmpeg) {
      // ffmpeg varsa → video-only stream (H.264 öncelikli) + ses WAV olarak
      const videoArgs = [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', `bestvideo[height<=${height}][ext=mp4][vcodec^=avc]/bestvideo[height<=${height}][ext=mp4]/bestvideo[height<=${height}][vcodec^=avc]/bestvideo[height<=${height}]`,
        ...platformArgs,
        '-o', path.join(downloadDir, '%(title)s [Video].%(ext)s'),
        '--progress', url
      ];
      const audioArgs = [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'wav',
        ...ffmpegArgs,
        ...platformArgs,
        '-o', path.join(downloadDir, '%(title)s [Ses].%(ext)s'),
        '--progress', url
      ];
      startProc(videoId, videoArgs, { url });
      startProc(audioId, audioArgs, { url });

    } else {
      // ffmpeg yok → combined stream + ses m4a
      const videoArgs = [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', `best[height<=${height}][ext=mp4]/best[height<=${height}]/best`,
        ...platformArgs,
        '-o', path.join(downloadDir, '%(title)s [Video].%(ext)s'),
        '--progress', url
      ];
      const audioArgs = [
        isPlaylist ? '--yes-playlist' : '--no-playlist',
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        ...platformArgs,
        '-o', path.join(downloadDir, '%(title)s [Ses].%(ext)s'),
        '--progress', url
      ];
      startProc(videoId, videoArgs, { url });
      startProc(audioId, audioArgs, { url });
    }

  } else {
    // ── Normal: sesli birleşik mp4 ───────────────────────────────
    // H.264 (avc) öncelikli — HEVC codec gerektirmez, her Windows'ta çalışır
    let fmt;
    if (isTikTok) {
      if (tikEmbedUrl && hasFfmpeg) {
        // ffmpeg varsa: filigransız video + embed ses → birleştir
        res.json({ downloadId });
        runTikTokWatermarkFree(downloadId, url, tikEmbedUrl, platformArgs, ffmpegArgs, downloadDir, height);
        return;
      } else if (tikEmbedUrl) {
        // ffmpeg yoksa: embed URL'den sesli indir (filigranli ama sesli)
        res.json({ downloadId });
        getTikTokTitle(url, platformArgs).then((title) => {
          const outTpl = title
            ? path.join(downloadDir, `${title}.mp4`)
            : path.join(downloadDir, '%(title)s.mp4');
          const args = [
            '--playlist-items', '1', '--remux-video', 'mp4', '--merge-output-format', 'mp4',
            '-o', outTpl, '--progress', tikEmbedUrl
          ];
          startProc(downloadId, args, { url, title });
        });
        return;
      }
      // Embed URL oluşturulamazsa (kısa URL vb.) fallback
      fmt = `best[ext=mp4][acodec!=none]/best[acodec!=none]/best`;
    } else if (hasFfmpeg) {
      // H.264 video + m4a ses (öncelik), fallback'te diğer formatlar
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
      // ffmpeg yok → sesli birleşik H.264 stream
      fmt = `best[height<=${height}][ext=mp4][vcodec^=avc]/best[height<=${height}][ext=mp4]/best[height<=${height}]/best`;
    }

    const args = [
      isPlaylist ? '--yes-playlist' : '--no-playlist',
      '-f', fmt,
      '--merge-output-format', 'mp4',
      ...ffmpegArgs,
      ...platformArgs,
      '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
      '--progress', url
    ];
    res.json({ downloadId });
    startProc(downloadId, args, { url });
  }
});

function parseProgress(line, downloadId) {
  // [download] Downloading item 3 of 12
  const plMatch = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
  if (plMatch) {
    broadcast({ type: 'status', downloadId, message: `Playlist: ${plMatch[1]} / ${plMatch[2]}` });
    return;
  }

  // [download]  45.2% of 5.23MiB at 1.23MiB/s ETA 00:03
  const dlMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)\s+ETA\s+(\S+)/);
  if (dlMatch) {
    broadcast({
      type: 'progress',
      downloadId,
      percent: parseFloat(dlMatch[1]),
      size: dlMatch[2],
      speed: dlMatch[3],
      eta: dlMatch[4]
    });
    return;
  }

  // [download] Destination: ...
  const destMatch = line.match(/\[download\] Destination: (.+)/);
  if (destMatch) {
    broadcast({ type: 'filename', downloadId, filename: path.basename(destMatch[1]) });
    return;
  }

  // Merging formats
  if (line.includes('[Merger]') || line.includes('Merging')) {
    broadcast({ type: 'status', downloadId, message: 'Merging...' });
    return;
  }

  if (line.includes('[ExtractAudio]') || line.includes('Extracting audio')) {
    broadcast({ type: 'status', downloadId, message: 'Extracting audio...' });
    return;
  }
}

// İndirme geçmişi
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.post('/api/history/clear', (req, res) => {
  try { fs.writeFileSync(HISTORY_FILE, '[]'); } catch {}
  res.json({ ok: true });
});

// yt-dlp versiyonu
app.get('/api/ytdlp-version', (req, res) => {
  res.json({ version: cachedYtDlpVersion });
});

// Oynatma listesi bilgisi
app.post('/api/playlist-info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL gerekli' });

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
        title: info.title || info.playlist_title || 'Oynatma Listesi',
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

// İndirme iptal
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

// Klasörü Explorer'da aç
app.post('/api/open-folder', (req, res) => {
  const { dir } = req.body;
  const target = (dir && fs.existsSync(dir)) ? dir : DEFAULT_DOWNLOAD_DIR;
  require('child_process').exec(`explorer "${target}"`);
  res.json({ ok: true });
});

// yt-dlp güncelle
app.post('/api/update-ytdlp', (req, res) => {
  res.json({ ok: true, message: 'Güncelleme başlatıldı...' });
  const proc = spawn(YT_DLP, ['-U']);
  proc.stdout.on('data', (d) => broadcast({ type: 'log', message: d.toString() }));
  proc.stderr.on('data', (d) => broadcast({ type: 'log', message: d.toString() }));
  proc.on('close', () => {
    broadcast({ type: 'log', message: 'Update complete.' });
    fetchYtDlpVersion(ver => { if (ver) broadcast({ type: 'ytdlp-version', version: ver }); });
  });
});

const PORT = 3434;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${PORT} zaten kullanımda!`);
    console.error(`   Başka bir MediaFetch penceresi açık olabilir.`);
    console.error(`   Lütfen o pencereyi kapatıp tekrar deneyin.\n`);
    process.exit(1);
  } else { throw err; }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n=== MediaFetch ===`);
  console.log(`Tarayıcıda açın: http://localhost:${PORT}`);
  console.log('Kapatmak için Ctrl+C\n');

  // yt-dlp otomatik güncelle
  autoUpdateYtDlp();

  // Tarayıcıyı otomatik aç
  const { exec } = require('child_process');
  setTimeout(() => exec(`start http://localhost:${PORT}`), 1000);
});
