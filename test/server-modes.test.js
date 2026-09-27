'use strict';
/*
 * Offline tests for the local/server split.
 *
 * Boots the real server.js twice — once headless with a token, once in local
 * mode — on a throwaway port and checks the behaviour that the hosted
 * deployment depends on. No network calls to any media site.
 *
 * Run with:  node test/server-modes.test.js
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const TOKEN = 'test-token-' + Math.random().toString(36).slice(2, 10);

let passed = 0, failed = 0;
function ok(name) { passed++; console.log('  ✓ ' + name); }
function bad(name, err) { failed++; console.log('  ✗ ' + name + '\n      ' + (err && err.message || err)); }
async function test(name, fn) {
  try { await fn(); ok(name); } catch (err) { bad(name, err); }
}

function request(port, pathname, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, headers: headers || {} }, (res) => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('request timeout')); });
  });
}

// Boot server.js and wait for the "Listening on" line it prints.
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
    child.on('exit', (code) => {
      if (!out.includes('Listening on')) {
        clearTimeout(timer);
        reject(new Error('server exited with code ' + code + ':\n' + out));
      }
    });
  });
}

const freePort = () => 20000 + Math.floor(Math.random() * 20000);

async function main() {
  const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediafetch-test-'));

  /* ── Hosted mode, auth on ─────────────────────────────── */
  console.log('\nServer mode (token required)');
  const portA = freePort();
  const a = await boot({
    MEDIAFETCH_MODE: 'server',
    MEDIAFETCH_PORT: String(portA),
    MEDIAFETCH_HOST: '127.0.0.1',
    MEDIAFETCH_TOKEN: TOKEN,
    MEDIAFETCH_DOWNLOAD_DIR: dlDir,
  });

  try {
    await test('starts in server mode and announces the port', () => {
      assert(a.out.includes('mode: server'), 'expected "mode: server" in output');
      assert(a.out.includes('Listening on 127.0.0.1:' + portA));
    });

    await test('/api/health answers without a token', async () => {
      const res = await request(portA, '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.mode, 'server');
      assert.strictEqual(res.json.auth, true);
    });

    await test('an API call without a token is rejected', async () => {
      const res = await request(portA, '/api/config');
      assert.strictEqual(res.status, 401);
    });

    await test('the web UI without a token shows the login page', async () => {
      const res = await request(portA, '/');
      assert.strictEqual(res.status, 401);
      assert(/MediaFetch/.test(res.body), 'expected the login page');
    });

    await test('a header token is accepted', async () => {
      const res = await request(portA, '/api/config', { 'X-MediaFetch-Token': TOKEN });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.serverMode, true);
    });

    await test('a query token is accepted (WebSocket / one-click login)', async () => {
      const res = await request(portA, '/api/config?token=' + encodeURIComponent(TOKEN));
      assert.strictEqual(res.status, 200);
    });

    await test('a cookie token is accepted', async () => {
      const res = await request(portA, '/api/config', { Cookie: 'mf_token=' + TOKEN });
      assert.strictEqual(res.status, 200);
    });

    await test('a wrong token is rejected', async () => {
      const res = await request(portA, '/api/config', { 'X-MediaFetch-Token': TOKEN + 'x' });
      assert.strictEqual(res.status, 401);
    });

    await test('/login with the right token sets the session cookie', async () => {
      const res = await request(portA, '/login?t=' + encodeURIComponent(TOKEN));
      assert.strictEqual(res.status, 302);
      assert(/mf_token=/.test(String(res.headers['set-cookie'] || '')), 'expected a Set-Cookie header');
    });

    await test('hosted mode reports no desktop capabilities', async () => {
      const res = await request(portA, '/api/config', { 'X-MediaFetch-Token': TOKEN });
      assert.strictEqual(res.json.canOpenFolder, false, 'canOpenFolder must be false');
      assert.strictEqual(res.json.allowCustomDir, false, 'allowCustomDir must be false');
      assert.strictEqual(res.json.downloadDir, dlDir);
    });

    await test('an unknown file id is a 404, not a path read', async () => {
      const res = await request(portA, '/api/file/does-not-exist', { 'X-MediaFetch-Token': TOKEN });
      assert.strictEqual(res.status, 404);
    });

    await test('a traversal-looking file id is still just a 404', async () => {
      const res = await request(portA, '/api/file/' + encodeURIComponent('../../server.js'),
        { 'X-MediaFetch-Token': TOKEN });
      assert.strictEqual(res.status, 404);
      assert(!/express/.test(res.body), 'server.js content must never be served');
    });

    await test('CORS allows an extension origin and the auth header', async () => {
      const res = await request(portA, '/api/health', { Origin: 'chrome-extension://abcdefghijklmnop' });
      assert.strictEqual(res.headers['access-control-allow-origin'], 'chrome-extension://abcdefghijklmnop');
      assert(/X-MediaFetch-Token/i.test(res.headers['access-control-allow-headers'] || ''),
        'the token header must be allowed');
    });

    await test('CORS does not open up to an arbitrary website', async () => {
      const res = await request(portA, '/api/health', { Origin: 'https://evil.example' });
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    });
  } finally {
    a.child.kill();
  }

  /* ── Local mode ───────────────────────────────────────── */
  console.log('\nLocal mode (desktop)');
  const portB = freePort();
  const b = await boot({
    MEDIAFETCH_MODE: 'local',
    MEDIAFETCH_PORT: String(portB),
    MEDIAFETCH_HOST: '127.0.0.1',
  });

  try {
    await test('starts in local mode on loopback', () => {
      assert(b.out.includes('mode: local'), 'expected "mode: local" in output');
      assert(b.out.includes('Listening on 127.0.0.1:' + portB));
    });

    await test('no token means no gate', async () => {
      const res = await request(portB, '/api/config');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.auth, false);
    });

    await test('local mode keeps the desktop capabilities', async () => {
      const res = await request(portB, '/api/config');
      assert.strictEqual(res.json.serverMode, false);
      assert.strictEqual(res.json.canOpenFolder, true);
      assert.strictEqual(res.json.allowCustomDir, true);
    });

    await test('the web UI is served without a login page', async () => {
      const res = await request(portB, '/');
      assert.strictEqual(res.status, 200);
      assert(/<title>/i.test(res.body));
    });
  } finally {
    b.child.kill();
  }

  try { fs.rmSync(dlDir, { recursive: true, force: true }); } catch {}

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nTest harness failed:', err);
  process.exit(1);
});
