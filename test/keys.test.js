'use strict';
/*
 * Per-person access keys.
 *
 * Boots the real server.js with an owner token, then exercises minting,
 * using, revoking and deleting a named key. No network access to any media
 * site — nothing here starts a download.
 *
 * Run with:  node test/keys.test.js
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const KEYS_FILE = path.join(ROOT, 'keys.json');
const OWNER = 'owner-token-' + Math.random().toString(36).slice(2, 10);

let passed = 0, failed = 0;
function ok(name) { passed++; console.log('  ✓ ' + name); }
function bad(name, err) { failed++; console.log('  ✗ ' + name + '\n      ' + ((err && err.message) || err)); }
async function test(name, fn) {
  try { await fn(); ok(name); } catch (err) { bad(name, err); }
}

function request(port, method, pathname, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, path: pathname, method,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function boot(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, MEDIAFETCH_OPEN_BROWSER: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('server did not start in time:\n' + out));
    }, 20000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      if (out.includes('Listening on')) { clearTimeout(timer); resolve({ child, out }); }
    });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

const freePort = () => 20000 + Math.floor(Math.random() * 20000);
const ownerHdr = { 'X-MediaFetch-Token': OWNER };

async function main() {
  // The server keeps keys beside itself; start from a clean slate and put the
  // previous file back afterwards so running tests never costs real keys.
  const hadKeys = fs.existsSync(KEYS_FILE);
  const backup = hadKeys ? fs.readFileSync(KEYS_FILE) : null;
  if (hadKeys) fs.unlinkSync(KEYS_FILE);

  const port = freePort();
  const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediafetch-keys-'));
  const server = await boot({
    MEDIAFETCH_MODE: 'server',
    MEDIAFETCH_PORT: String(port),
    MEDIAFETCH_HOST: '127.0.0.1',
    MEDIAFETCH_TOKEN: OWNER,
    MEDIAFETCH_DOWNLOAD_DIR: dlDir,
  });

  let personal = null;

  try {
    console.log('\nPer-person keys');

    await test('the owner starts with no keys', async () => {
      const res = await request(port, 'GET', '/api/keys', { headers: ownerHdr });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.json.keys, []);
    });

    await test('a stranger cannot list keys', async () => {
      const res = await request(port, 'GET', '/api/keys');
      assert.strictEqual(res.status, 401);
    });

    await test('the owner mints a named key', async () => {
      const res = await request(port, 'POST', '/api/keys', { headers: ownerHdr, body: { name: 'Ahmet' } });
      assert.strictEqual(res.status, 200);
      personal = res.json.key;
      assert.strictEqual(personal.name, 'Ahmet');
      assert.match(personal.key, /^[0-9a-f]{48}$/, 'key should be 24 random bytes in hex');
      assert.strictEqual(personal.disabled, false);
      assert.strictEqual(personal.downloads, 0);
    });

    await test('a key with no name is refused', async () => {
      const res = await request(port, 'POST', '/api/keys', { headers: ownerHdr, body: { name: '   ' } });
      assert.strictEqual(res.status, 400);
    });

    await test('the named key can use the app', async () => {
      const res = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': personal.key } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.user, 'Ahmet');
      assert.strictEqual(res.json.isOwner, false, 'a named key is not the owner');
    });

    await test('the owner is identified as the owner', async () => {
      const res = await request(port, 'GET', '/api/config', { headers: ownerHdr });
      assert.strictEqual(res.json.isOwner, true);
    });

    await test('a named key cannot mint more keys', async () => {
      const res = await request(port, 'POST', '/api/keys', {
        headers: { 'X-MediaFetch-Token': personal.key }, body: { name: 'sneaky' },
      });
      assert.strictEqual(res.status, 403);
    });

    await test('a named key cannot revoke keys', async () => {
      const res = await request(port, 'POST', `/api/keys/${personal.id}/toggle`, {
        headers: { 'X-MediaFetch-Token': personal.key },
      });
      assert.strictEqual(res.status, 403);
    });

    await test('/login accepts a named key and sets its cookie', async () => {
      const res = await request(port, 'GET', '/login?t=' + encodeURIComponent(personal.key));
      assert.strictEqual(res.status, 302);
      const cookie = String(res.headers['set-cookie'] || '');
      assert(cookie.includes(encodeURIComponent(personal.key)), 'the cookie should carry that person’s key');
    });

    await test('revoking the key locks that person out immediately', async () => {
      const off = await request(port, 'POST', `/api/keys/${personal.id}/toggle`, { headers: ownerHdr });
      assert.strictEqual(off.status, 200);
      assert.strictEqual(off.json.key.disabled, true);

      const res = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': personal.key } });
      assert.strictEqual(res.status, 401);
    });

    await test('a revoked key cannot start a download', async () => {
      const res = await request(port, 'POST', '/api/download', {
        headers: { 'X-MediaFetch-Token': personal.key },
        body: { url: 'https://example.com/x', formatId: 'mp3-320' },
      });
      assert.strictEqual(res.status, 401);
    });

    await test('re-enabling lets that person back in', async () => {
      await request(port, 'POST', `/api/keys/${personal.id}/toggle`, { headers: ownerHdr });
      const res = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': personal.key } });
      assert.strictEqual(res.status, 200);
    });

    await test('revoking one key leaves the others working', async () => {
      const second = (await request(port, 'POST', '/api/keys', { headers: ownerHdr, body: { name: 'Ayşe' } })).json.key;
      await request(port, 'POST', `/api/keys/${personal.id}/toggle`, { headers: ownerHdr });

      const blocked = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': personal.key } });
      const allowed = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': second.key } });
      assert.strictEqual(blocked.status, 401);
      assert.strictEqual(allowed.status, 200);
      assert.strictEqual(allowed.json.user, 'Ayşe');

      await request(port, 'POST', `/api/keys/${second.id}/delete`, { headers: ownerHdr });
    });

    await test('deleting a key removes it for good', async () => {
      const res = await request(port, 'POST', `/api/keys/${personal.id}/delete`, { headers: ownerHdr });
      assert.strictEqual(res.status, 200);

      const list = await request(port, 'GET', '/api/keys', { headers: ownerHdr });
      assert.strictEqual(list.json.keys.length, 0);

      const after = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': personal.key } });
      assert.strictEqual(after.status, 401);
    });

    await test('deleting a key that is not there is a 404', async () => {
      const res = await request(port, 'POST', '/api/keys/deadbeef/delete', { headers: ownerHdr });
      assert.strictEqual(res.status, 404);
    });

    await test('keys survive a restart', async () => {
      const made = (await request(port, 'POST', '/api/keys', { headers: ownerHdr, body: { name: 'Kalıcı' } })).json.key;
      server.child.kill();
      await new Promise(r => setTimeout(r, 1200));

      const again = await boot({
        MEDIAFETCH_MODE: 'server',
        MEDIAFETCH_PORT: String(port),
        MEDIAFETCH_HOST: '127.0.0.1',
        MEDIAFETCH_TOKEN: OWNER,
        MEDIAFETCH_DOWNLOAD_DIR: dlDir,
      });
      server.child = again.child;

      const res = await request(port, 'GET', '/api/config', { headers: { 'X-MediaFetch-Token': made.key } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.user, 'Kalıcı');
    });
  } finally {
    try { server.child.kill(); } catch {}
    try { fs.rmSync(dlDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(KEYS_FILE); } catch {}
    if (backup) fs.writeFileSync(KEYS_FILE, backup);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nTest harness failed:', err);
  process.exit(1);
});
