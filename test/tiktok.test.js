'use strict';
/*
 * Offline unit tests for the TikTok layer.
 *
 * These tests do NOT hit the network / real TikTok. They extract the pure
 * TikTok helper functions straight out of server.js source and exercise them
 * with mock inputs, so they validate the shipping code (not a copy) while
 * staying safe to run in CI.
 *
 * Run with:  node test/tiktok.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Slice out the contiguous block of pure TikTok helpers (no I/O, no server).
const start = SRC.indexOf('const TIKTOK_MEDIA_HOSTS');
const end = SRC.indexOf('// yt-dlp fallback for TikTok');
assert(start !== -1 && end !== -1 && end > start,
  'Could not locate the TikTok helper block in server.js');
const block = SRC.slice(start, end);

// Evaluate the block in an isolated scope and expose the functions.
const factory = new Function(
  `${block}\n return { TIKTOK_MEDIA_HOSTS, isSafeTikTokMediaUrl, tiktokVideoFormat, toTikTokEmbedUrl, ttExtractJsonBlobs, ttPlayAddrFromJson, ttPickUrl };`
);
const { isSafeTikTokMediaUrl, tiktokVideoFormat, toTikTokEmbedUrl, ttExtractJsonBlobs, ttPlayAddrFromJson, ttPickUrl } = factory();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}

console.log('\nURL normalization (toTikTokEmbedUrl)');
test('canonical /@user/video/<id>', () => {
  assert.strictEqual(
    toTikTokEmbedUrl('https://www.tiktok.com/@user/video/7412345678901234567'),
    'https://www.tiktok.com/embed/v2/7412345678901234567');
});
test('canonical URL with query params is stripped', () => {
  assert.strictEqual(
    toTikTokEmbedUrl('https://www.tiktok.com/@user/video/7412345678901234567?is_from_webapp=1&sender_device=pc'),
    'https://www.tiktok.com/embed/v2/7412345678901234567');
});
test('/v/<id> short-path form', () => {
  assert.strictEqual(
    toTikTokEmbedUrl('https://www.tiktok.com/v/7412345678901234567.html'),
    'https://www.tiktok.com/embed/v2/7412345678901234567');
});
test('/photo/<id> form', () => {
  assert.strictEqual(
    toTikTokEmbedUrl('https://www.tiktok.com/@user/photo/7412345678901234567'),
    'https://www.tiktok.com/embed/v2/7412345678901234567');
});
test('item_id query param form', () => {
  assert.strictEqual(
    toTikTokEmbedUrl('https://m.tiktok.com/v/?item_id=7412345678901234567'),
    'https://www.tiktok.com/embed/v2/7412345678901234567');
});
test('vm.tiktok.com short link → null (handled by yt-dlp path)', () => {
  assert.strictEqual(toTikTokEmbedUrl('https://vm.tiktok.com/ZMabcдEF/'), null);
});
test('vt.tiktok.com short link → null', () => {
  assert.strictEqual(toTikTokEmbedUrl('https://vt.tiktok.com/ZSABCDE/'), null);
});
test('garbage input → null', () => {
  assert.strictEqual(toTikTokEmbedUrl('not a url at all'), null);
});
test('too-short numeric id (<6 digits) → null', () => {
  assert.strictEqual(toTikTokEmbedUrl('https://www.tiktok.com/@u/video/123'), null);
});

console.log('\nQuality / format selection (tiktokVideoFormat)');
for (const h of [2160, 1440, 1080, 720, 480, 360]) {
  test(`height ${h} is embedded in the selector`, () => {
    const f = tiktokVideoFormat(String(h));
    assert(f.includes(`height<=${h}`), `selector missing height<=${h}: ${f}`);
  });
}
test('no hardcoded height<=1080 for a 720 request', () => {
  const f = tiktokVideoFormat('720');
  assert(!f.includes('height<=1080'), 'selector still hardcodes 1080: ' + f);
});
test('progressive (single-file) selector is tried first for TikTok', () => {
  const f = tiktokVideoFormat('720');
  assert(f.startsWith('best[height<=720]'),
    'expected progressive best[...] first, got: ' + f);
});
test('always ends with a bare "best" so download never hard-fails', () => {
  assert(tiktokVideoFormat('480').split('/').pop() === 'best');
});
test('invalid/empty height → sensible best selector, no NaN', () => {
  const f = tiktokVideoFormat(undefined);
  assert(!/NaN/.test(f), 'NaN leaked into selector: ' + f);
  assert(f.includes('best'), f);
});

console.log('\nMedia-source safety (isSafeTikTokMediaUrl) — SSRF guard');
test('accepts a real tiktokcdn host over https', () => {
  assert.strictEqual(
    isSafeTikTokMediaUrl('https://v16-webapp.tiktokcdn.com/abc/video.mp4?a=1'), true);
});
test('accepts tiktokv.com subdomain', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('https://api.tiktokv.com/media/x.mp4'), true);
});
test('rejects http (non-TLS)', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('http://v16-webapp.tiktokcdn.com/x.mp4'), false);
});
test('rejects an arbitrary/attacker host', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('https://evil.example.com/x.mp4'), false);
});
test('rejects loopback', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('https://127.0.0.1/x.mp4'), false);
});
test('rejects private LAN range', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('https://192.168.1.10/x.mp4'), false);
  assert.strictEqual(isSafeTikTokMediaUrl('https://10.0.0.5/x.mp4'), false);
});
test('rejects lookalike suffix (tiktokcdn.com.evil.com)', () => {
  assert.strictEqual(isSafeTikTokMediaUrl('https://tiktokcdn.com.evil.com/x.mp4'), false);
});
test('rejects garbage input', () => {
  assert.strictEqual(isSafeTikTokMediaUrl(']{not a url'), false);
});

console.log('\nJSON-first parser (item #6)');
test('ttPickUrl handles string / urlList / url shapes', () => {
  assert.strictEqual(ttPickUrl('https://cdn/x.mp4'), 'https://cdn/x.mp4');
  assert.strictEqual(ttPickUrl({ urlList: ['https://cdn/a.mp4'] }), 'https://cdn/a.mp4');
  assert.strictEqual(ttPickUrl({ url: 'https://cdn/c.mp4' }), 'https://cdn/c.mp4');
  assert.strictEqual(ttPickUrl({ nope: 1 }), null);
});
test('picks playAddr, never download_addr', () => {
  const obj = { itemInfo: { video: {
    playAddr: { urlList: ['https://v16.tiktokcdn.com/clean.mp4'] },
    downloadAddr: { urlList: ['https://v16.tiktokcdn.com/WATERMARK.mp4'] },
  } } };
  assert.strictEqual(ttPlayAddrFromJson(obj), 'https://v16.tiktokcdn.com/clean.mp4');
});
test('download_addr only => null (watermarked source rejected)', () => {
  const obj = { video: { download_addr: { url_list: ['https://cdn/wm.mp4'] } } };
  assert.strictEqual(ttPlayAddrFromJson(obj), null);
});
test('snake_case play_addr deep in tree', () => {
  const obj = { a: { b: { play_addr: { url_list: ['https://cdn/clean2.mp4'] } } } };
  assert.strictEqual(ttPlayAddrFromJson(obj), 'https://cdn/clean2.mp4');
});
test('extracts + parses a realistic embed script blob', () => {
  const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">`
    + `{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"itemInfo":{"itemStruct":`
    + `{"video":{"playAddr":{"urlList":["https://v19.tiktokcdn.com/j.mp4"]},`
    + `"downloadAddr":{"urlList":["https://v19.tiktokcdn.com/wm.mp4"]}}}}}}}</script>`;
  const blobs = ttExtractJsonBlobs(html);
  assert(blobs.length >= 1);
  const u = ttPlayAddrFromJson(JSON.parse(blobs[0]));
  assert.strictEqual(u, 'https://v19.tiktokcdn.com/j.mp4');
});

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
