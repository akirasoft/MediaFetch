// Icon generator — node create_icons.js (no dependencies)
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tp  = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tp, data])));
  return Buffer.concat([len, tp, data, crc]);
}

function makePNG(S) {
  const BG  = [0x0f, 0x11, 0x17];  // near-black bg
  const GRN = [0x1d, 0xb9, 0x54];  // green waveform bars
  const WHT = [0xff, 0xff, 0xff];  // white arrow

  // Waveform bars — 5 bars (3 for tiny icon), bottom-aligned, top 60% of icon
  const barCount  = S < 24 ? 3 : 5;
  const waveTop   = Math.floor(S * 0.10);
  const waveBot   = Math.floor(S * 0.60);
  const waveH     = waveBot - waveTop;

  const rawBarW   = Math.max(1, Math.floor(S / (barCount * 2.2)));
  const gap       = Math.max(1, rawBarW);
  const totalBarW = barCount * rawBarW + (barCount - 1) * gap;
  const startX    = Math.floor((S - totalBarW) / 2);

  const heights = barCount === 3
    ? [0.55, 0.85, 0.55]
    : [0.40, 0.65, 0.85, 0.55, 0.35];

  const bars = heights.map((frac, i) => {
    const bh = Math.max(1, Math.floor(waveH * frac));
    return {
      x1: startX + i * (rawBarW + gap),
      x2: startX + i * (rawBarW + gap) + rawBarW - 1,
      y1: waveBot - bh,
      y2: waveBot - 1
    };
  });

  // Download arrow — bottom 35% of icon
  const arrTop = Math.floor(S * 0.65);
  const arrBot = Math.floor(S * 0.92);
  const mid    = Math.floor(S / 2);
  const sw     = Math.max(1, Math.floor(S * 0.07));
  const hh     = Math.max(2, Math.floor((arrBot - arrTop) * 0.44));
  const hw     = Math.max(2, Math.floor(S * 0.22));

  function isBar(x, y) {
    for (const b of bars) {
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) return true;
    }
    return false;
  }

  function isArrow(x, y) {
    if (y >= arrTop && y < arrBot - hh) {
      return x >= mid - sw && x <= mid + sw;
    }
    if (y >= arrBot - hh && y <= arrBot) {
      const progress = (y - (arrBot - hh)) / hh;
      const halfW    = Math.round(hw * progress);
      return x >= mid - halfW && x <= mid + halfW;
    }
    return false;
  }

  // Rounded rect clipping
  const radius = Math.floor(S * 0.22);
  function insideRR(x, y) {
    const cx = Math.min(Math.max(x, radius), S - 1 - radius);
    const cy = Math.min(Math.max(y, radius), S - 1 - radius);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  const pixels = [];
  for (let y = 0; y < S; y++) {
    pixels.push(0);
    for (let x = 0; x < S; x++) {
      if (!insideRR(x, y)) {
        pixels.push(...BG);
      } else if (isBar(x, y)) {
        pixels.push(...GRN);
      } else if (isArrow(x, y)) {
        pixels.push(...WHT);
      } else {
        pixels.push(...BG);
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from(pixels))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir);

[16, 48, 128].forEach(size => {
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), makePNG(size));
  console.log(`✓ icon${size}.png created`);
});
console.log('Icons ready!');
