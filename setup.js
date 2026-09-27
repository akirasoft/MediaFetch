const https = require('https');
const fs = require('fs');
const path = require('path');

// Pick the release asset that matches this machine. On a Linux server prefer
// scripts/install-linux.sh instead — that one also fetches ffmpeg.
const IS_WIN = process.platform === 'win32';
const ASSET = IS_WIN ? 'yt-dlp.exe'
  : process.platform === 'darwin' ? 'yt-dlp_macos'
  : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64'
  : process.arch === 'arm' ? 'yt-dlp_linux_armv7l'
  : 'yt-dlp_linux';

const YT_DLP_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ASSET}`;
const BIN_DIR = path.join(__dirname, 'bin');
const YT_DLP_PATH = path.join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');

function download(url, dest, redirectCount = 0) {
  if (redirectCount > 10) {
    console.error('Too many redirects.');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = Math.round((downloaded / total) * 100);
          process.stdout.write(`\r  Downloading: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          process.stdout.write('\n');
          resolve();
        });
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('=== MediaFetch — Setup ===\n');

  if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

  if (fs.existsSync(YT_DLP_PATH)) {
    console.log('yt-dlp already installed. Skipping download.');
  } else {
    console.log('Downloading yt-dlp...');
    try {
      await download(YT_DLP_URL, YT_DLP_PATH);
      if (!IS_WIN) fs.chmodSync(YT_DLP_PATH, 0o755);
      console.log('yt-dlp installed successfully.');
    } catch (err) {
      console.error('Failed to download yt-dlp:', err.message);
      process.exit(1);
    }
  }

  console.log('\nSetup complete!');
  console.log('Run: node server.js');
  console.log(IS_WIN ? 'Or double-click start.bat'
    : 'For a server deployment run: sh scripts/install-linux.sh');
}

main();
