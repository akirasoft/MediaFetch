const https = require('https');
const fs = require('fs');
const path = require('path');

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const BIN_DIR = path.join(__dirname, 'bin');
const YT_DLP_PATH = path.join(BIN_DIR, 'yt-dlp.exe');

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
      console.log('yt-dlp installed successfully.');
    } catch (err) {
      console.error('Failed to download yt-dlp:', err.message);
      process.exit(1);
    }
  }

  console.log('\nSetup complete!');
  console.log('Run: node server.js');
  console.log('Or double-click start.bat');
}

main();
