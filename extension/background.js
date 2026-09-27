'use strict';

/* ═══════════════════════════════════════════════════════════════
   MediaFetch — service worker

   The popup is a window that closes the moment it loses focus, so it
   cannot be the thing that owns a download. This worker does instead:
   it talks to the MediaFetch server (local OR self-hosted), keeps the
   WebSocket alive, and — when the server is a remote one — pulls the
   finished file down to the user's computer with chrome.downloads.
   ═══════════════════════════════════════════════════════════════ */

const DEFAULTS = {
  serverUrl: 'http://localhost:3434',
  token: '',
  autoSave: true,          // fetch the finished file from a remote server
};

/* ── Ayarlar ──────────────────────────────────────────────── */
async function getCfg() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return {
    serverUrl: normalizeBase(stored.serverUrl || DEFAULTS.serverUrl),
    token: stored.token || '',
    autoSave: stored.autoSave !== false,
  };
}

function normalizeBase(raw) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return DEFAULTS.serverUrl;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s;
}

function isLocalServer(base) {
  try {
    const h = new URL(base).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch { return false; }
}

/* ── Sunucu çağrıları ─────────────────────────────────────── */
function authHeaders(cfg, extra) {
  const h = { ...(extra || {}) };
  if (cfg.token) h['X-MediaFetch-Token'] = cfg.token;
  return h;
}

async function apiFetch(cfg, path, init = {}) {
  const res = await fetch(cfg.serverUrl + path, {
    ...init,
    headers: authHeaders(cfg, init.headers),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function checkServer(cfg) {
  try {
    const res = await fetch(cfg.serverUrl + '/api/health', {
      headers: authHeaders(cfg),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { online: false, reason: 'http' + res.status };
    const info = await res.json().catch(() => ({}));
    // Auth is on but our token is missing/wrong? Any other endpoint proves it.
    if (info.auth) {
      const probe = await fetch(cfg.serverUrl + '/api/config', {
        headers: authHeaders(cfg),
        signal: AbortSignal.timeout(4000),
      });
      if (probe.status === 401) return { online: false, reason: 'auth', info };
    }
    return { online: true, info };
  } catch (err) {
    return { online: false, reason: err && err.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

/* ── İş listesi ───────────────────────────────────────────── */
const jobs = new Map();          // downloadId -> job

function jobList() {
  return [...jobs.values()].sort((a, b) => b.started - a.started).slice(0, 8);
}

function emit(message) {
  // No popup open is the normal case — the rejected promise is not an error.
  chrome.runtime.sendMessage(message).catch(() => {});
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  emit({ type: 'job', job });
  return job;
}

/* ── WebSocket ────────────────────────────────────────────── */
let ws = null;
let wsBase = '';
let keepAlive = null;
let reconnectTimer = null;

function wsUrlFor(cfg) {
  const u = new URL(cfg.serverUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/';
  // chrome.downloads and the WebSocket handshake cannot carry a custom header,
  // so the token travels as a query parameter here.
  if (cfg.token) u.search = '?token=' + encodeURIComponent(cfg.token);
  return u.toString();
}

function hasActiveJobs() {
  return [...jobs.values()].some(j => j.status === 'starting' || j.status === 'running' || j.status === 'processing');
}

async function connectWS(cfg) {
  if (ws && ws.readyState <= 1 && wsBase === cfg.serverUrl) return;
  closeWS();
  wsBase = cfg.serverUrl;

  try { ws = new WebSocket(wsUrlFor(cfg)); } catch { ws = null; return; }

  ws.addEventListener('open', () => {
    emit({ type: 'ws', online: true });
    // Traffic every 20s: keeps the reverse proxy from dropping the upgrade and
    // keeps this service worker from being shut down mid-download.
    clearInterval(keepAlive);
    keepAlive = setInterval(() => {
      try { ws && ws.readyState === 1 ? ws.send('ping') : null; } catch {}
    }, 20000);
  });

  ws.addEventListener('message', (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    handleServerMessage(msg);
  });

  ws.addEventListener('close', () => {
    clearInterval(keepAlive);
    emit({ type: 'ws', online: false });
    if (hasActiveJobs()) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => getCfg().then(connectWS), 2000);
    }
  });

  ws.addEventListener('error', () => { /* 'close' follows */ });
}

function closeWS() {
  clearInterval(keepAlive);
  clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch {} }
  ws = null;
}

function handleServerMessage(msg) {
  // The server broadcasts to every client; ignore anything not ours.
  if (!msg.downloadId || !jobs.has(msg.downloadId)) return;

  switch (msg.type) {
    case 'start':
      updateJob(msg.downloadId, { status: 'running' });
      break;
    case 'filename':
      updateJob(msg.downloadId, { filename: msg.filename || '' });
      break;
    case 'progress':
      updateJob(msg.downloadId, {
        status: 'running',
        percent: Math.max(0, Math.min(100, Number(msg.percent) || 0)),
        speed: msg.speed || '',
        eta: msg.eta || '',
        size: msg.size || '',
      });
      break;
    case 'status': {
      const patch = { msg: msg.message || '' };
      if (/merg|extract|final|validat/i.test(msg.message || '')) patch.status = 'processing';
      updateJob(msg.downloadId, patch);
      break;
    }
    case 'complete':
      onComplete(msg);
      break;
    case 'error':
      updateJob(msg.downloadId, { status: 'error', error: msg.message || '' });
      break;
    case 'cancelled':
      updateJob(msg.downloadId, { status: 'cancelled' });
      break;
  }
}

/* ── Tamamlanma ───────────────────────────────────────────── */
async function onComplete(msg) {
  const cfg = await getCfg();
  const job = updateJob(msg.downloadId, {
    status: 'complete',
    percent: 100,
    filename: msg.filename || (jobs.get(msg.downloadId) || {}).filename || '',
    fileUrl: msg.fileUrl || '',
    size: msg.size || 0,
  });
  if (!job) return;

  const remote = !isLocalServer(cfg.serverUrl);
  if (remote && job.fileUrl && cfg.autoSave) {
    saveToComputer(job, cfg);
  } else {
    notify(job.filename || 'MediaFetch', remote ? 'Sunucuda hazır' : 'Bilgisayarına kaydedildi');
  }
}

// A remote server downloaded onto its own disk, so the last hop is ours: pull
// the finished file through chrome.downloads so it lands in the user's Downloads.
function saveToComputer(job, cfg) {
  const base = cfg.serverUrl + job.fileUrl;
  // chrome.downloads cannot send headers, hence the token in the query string.
  const url = cfg.token ? base + '?token=' + encodeURIComponent(cfg.token) : base;
  const name = safeFilename(job.filename);

  updateJob(job.id, { status: 'saving' });

  chrome.downloads.download({ url, filename: name || undefined, saveAs: false }, (dlId) => {
    if (chrome.runtime.lastError || dlId === undefined) {
      // A name Chrome refuses (odd unicode, reserved word) — let it pick one
      // from the server's Content-Disposition header instead.
      chrome.downloads.download({ url, saveAs: false }, (retryId) => {
        if (chrome.runtime.lastError || retryId === undefined) {
          updateJob(job.id, { status: 'complete', saveError: true });
        } else {
          updateJob(job.id, { status: 'saved', browserDlId: retryId });
          notify(job.filename || 'MediaFetch', 'Bilgisayarına indirildi');
        }
      });
      return;
    }
    updateJob(job.id, { status: 'saved', browserDlId: dlId });
    notify(job.filename || 'MediaFetch', 'Bilgisayarına indirildi');
  });
}

function safeFilename(name) {
  if (!name) return '';
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')      // illegal on Windows
    .replace(/^[.\s]+|[.\s]+$/g, '')    // leading/trailing dots and spaces
    .slice(0, 180);
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: String(title).slice(0, 80),
      message: String(message).slice(0, 120),
    }, () => void chrome.runtime.lastError);
  } catch {}
}

/* ── İndirme başlat ───────────────────────────────────────── */
async function startDownload({ url, formatId, title }) {
  const cfg = await getCfg();
  const { ok, status, data } = await apiFetch(cfg, '/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formatId }),
  }).catch(() => ({ ok: false, status: 0, data: {} }));

  if (!ok) {
    return {
      ok: false,
      status,
      error: status === 401 ? 'auth' : (data.error || 'server'),
    };
  }

  const ids = [data.downloadId, data.audioDownloadId].filter(Boolean);
  for (const id of ids) {
    jobs.set(id, {
      id, url, title: title || '', formatId,
      filename: '', percent: 0, speed: '', eta: '', size: '',
      status: 'starting', msg: '', error: '', fileUrl: '',
      started: Date.now(),
    });
  }
  // Keep the list short; a stale job is only UI noise.
  while (jobs.size > 20) jobs.delete(jobs.keys().next().value);

  await connectWS(cfg);
  for (const id of ids) emit({ type: 'job', job: jobs.get(id) });
  return { ok: true, ids };
}

async function cancelDownload(id) {
  const cfg = await getCfg();
  await apiFetch(cfg, '/api/cancel/' + encodeURIComponent(id), { method: 'POST' }).catch(() => {});
  updateJob(id, { status: 'cancelled' });
  return { ok: true };
}

/* ── Popup ile konuşma ────────────────────────────────────── */
chrome.runtime.onMessage.addListener((req, _sender, respond) => {
  (async () => {
    switch (req && req.cmd) {
      case 'getState': {
        const cfg = await getCfg();
        const health = await checkServer(cfg);
        if (health.online) connectWS(cfg);
        respond({
          cfg,
          remote: !isLocalServer(cfg.serverUrl),
          jobs: jobList(),
          server: health,
        });
        return;
      }
      case 'check': {
        const cfg = await getCfg();
        respond(await checkServer(cfg));
        return;
      }
      case 'saveCfg': {
        const next = {
          serverUrl: normalizeBase(req.serverUrl),
          token: String(req.token || ''),
          autoSave: req.autoSave !== false,
        };
        await chrome.storage.local.set(next);
        closeWS();
        const health = await checkServer(next);
        if (health.online) connectWS(next);
        respond({ ok: true, cfg: next, remote: !isLocalServer(next.serverUrl), server: health });
        return;
      }
      case 'start':
        respond(await startDownload(req));
        return;
      case 'cancel':
        respond(await cancelDownload(req.id));
        return;
      case 'saveNow': {
        const cfg = await getCfg();
        const job = jobs.get(req.id);
        if (job && job.fileUrl) saveToComputer(job, cfg);
        respond({ ok: !!(job && job.fileUrl) });
        return;
      }
      default:
        respond({ ok: false, error: 'unknown command' });
    }
  })();
  return true;      // async respond
});
