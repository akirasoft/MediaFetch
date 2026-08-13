// İkon oluşturucu — node create_icons.js
// Bağımlılık yok, Node.js built-in modülleri kullanır
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32 tablosu
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

function makePNG(size) {
  // Renk paleti
  const BG  = [0x0c, 0x11, 0x18]; // #0c1118 koyu
  const ACC = [0x41, 0x69, 0xee]; // #4169ee mavi
  const WHT = [0xff, 0xff, 0xff]; // beyaz

  // Piksel grid (RGBA → RGB)
  const pixels = [];
  const S = size;

  // Aşağı ok tasarımı — boyuta göre ölçekle
  const mid  = Math.floor(S / 2);
  const stem = Math.max(1, Math.floor(S * 0.12));  // ok gövdesi kalınlığı
  const head = Math.max(2, Math.floor(S * 0.30));  // ok başı genişliği
  const padV = Math.floor(S * 0.15);               // dikey boşluk

  function isArrow(x, y) {
    // ok gövdesi: dikey çizgi ortalanmış
    const stemL = mid - stem, stemR = mid + stem;
    const stemTop = padV, stemBot = S - padV - head;
    if (x >= stemL && x <= stemR && y >= stemTop && y <= stemBot) return true;
    // ok başı: üçgen
    const headTop = S - padV - head;
    const spread  = y - headTop;
    if (y >= headTop && y <= S - padV) {
      const hw = Math.round((spread / head) * head);
      if (x >= mid - hw && x <= mid + hw) return true;
    }
    return false;
  }

  for (let y = 0; y < S; y++) {
    pixels.push(0); // filter byte
    for (let x = 0; x < S; x++) {
      // Yuvarlak arka plan
      const dx = x - mid, dy = y - mid, r = S / 2 - 1;
      if (dx * dx + dy * dy > r * r) {
        // Şeffaf dış — beyaz ile doldur (ikon arkaplanı tarayıcıya bırak)
        pixels.push(...BG);
      } else if (isArrow(x, y)) {
        pixels.push(...WHT);
      } else {
        pixels.push(...ACC);
      }
    }
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(S, 0);
  ihdrData.writeUInt32BE(S, 4);
  ihdrData[8] = 8; ihdrData[9] = 2; // 8-bit RGB

  const compressed = zlib.deflateSync(Buffer.from(pixels));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG magic
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir);

[16, 48, 128].forEach(size => {
  const fp = path.join(iconDir, `icon${size}.png`);
  fs.writeFileSync(fp, makePNG(size));
  console.log(`✓ icon${size}.png oluşturuldu`);
});

console.log('İkonlar hazır!');
