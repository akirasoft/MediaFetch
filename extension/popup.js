'use strict';

const SERVER = 'http://localhost:3434';
const WS_URL = 'ws://localhost:3434';

/* ── Çeviri tablosu ─────────────────────────────────────── */
const LANG = {
  tr: {
    detecting:    'Sayfa algılanıyor…',
    notSupported: 'Bu sayfada çalışmaz (http/https gerekli)',
    serverDown:   '⚠ Sunucu çalışmıyor — start.bat ile başlatın',
    srvTitle:     'Sunucu bağlantısı',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ İndir',
    dlBtnStart:   '↻ Başlatılıyor…',
    dlBtnDl:      '⬇ İndiriliyor…',
    dlBtnDone:    '⬇ Tekrar İndir',
    dlBtnRetry:   '⬇ Tekrar Dene',
    fileStart:    'Başlatılıyor…',
    saved:        '✓ Kaydedildi',
    errDefault:   'Hata oluştu',
    noConn:       'Sunucuya bağlanılamadı',
    serverErr:    'Sunucu hatası',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  },
  en: {
    detecting:    'Detecting page…',
    notSupported: 'Not supported here (http/https required)',
    serverDown:   '⚠ Server not running — launch start.bat',
    srvTitle:     'Server connection',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ Download',
    dlBtnStart:   '↻ Starting…',
    dlBtnDl:      '⬇ Downloading…',
    dlBtnDone:    '⬇ Download Again',
    dlBtnRetry:   '⬇ Retry',
    fileStart:    'Starting…',
    saved:        '✓ Saved',
    errDefault:   'An error occurred',
    noConn:       'Could not connect to server',
    serverErr:    'Server error',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  },
  es: {
    detecting:    'Detectando página…',
    notSupported: 'No compatible aquí (se requiere http/https)',
    serverDown:   '⚠ Servidor inactivo — ejecuta start.bat',
    srvTitle:     'Conexión al servidor',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ Descargar',
    dlBtnStart:   '↻ Iniciando…',
    dlBtnDl:      '⬇ Descargando…',
    dlBtnDone:    '⬇ Descargar otra vez',
    dlBtnRetry:   '⬇ Reintentar',
    fileStart:    'Iniciando…',
    saved:        '✓ Guardado',
    errDefault:   'Ocurrió un error',
    noConn:       'No se pudo conectar al servidor',
    serverErr:    'Error del servidor',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  }
};

let currentLang = 'tr';
let L = LANG.tr;

/* ── DOM referansları ────────────────────────────────────── */
const srvDot       = document.getElementById('srvDot');
const urlBar       = document.getElementById('urlBar');
const qualities    = document.getElementById('qualities');
const btnDl        = document.getElementById('btnDl');
const progressWrap = document.getElementById('progressWrap');
const dlFilename   = document.getElementById('dlFilename');
const progFill     = document.getElementById('progFill');
const progPct      = document.getElementById('progPct');
const progSpeed    = document.getElementById('progSpeed');
const progEta      = document.getElementById('progEta');
const progMsg      = document.getElementById('progMsg');

let currentUrl  = '';
let currentType = 'audio';
let ws          = null;
let activeId    = null;
let serverOnline = false;

/* ── Dil uygula ─────────────────────────────────────────── */
function applyLang(lang, save) {
  currentLang = lang;
  L = LANG[lang] || LANG.tr;

  // data-i18n elementleri güncelle
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (L[key]) el.textContent = L[key];
  });

  // Aktif lang-btn vurgula
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  // URL bar — sadece placeholder durumlarda güncelle
  if (!currentUrl) {
    urlBar.textContent = serverOnline ? L.detecting : L.serverDown;
  } else if (urlBar.textContent === '' || urlBar.textContent === LANG.tr.detecting
      || urlBar.textContent === LANG.en.detecting || urlBar.textContent === LANG.es.detecting) {
    urlBar.textContent = L.detecting;
  }

  srvDot.title = L.srvTitle;
  renderQualities();

  // Tercihi kaydet (sadece kullanıcı değiştirildiğinde)
  if (save) {
    try { chrome.storage.local.set({ lang }); } catch {}
  }
}

/* ── Sunucu ping ─────────────────────────────────────────── */
async function checkServer() {
  try {
    const r = await fetch(`${SERVER}/api/ffmpeg-status`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      serverOnline = true;
      srvDot.className = 'srv-dot online';
      btnDl.disabled = !currentUrl;
      return true;
    }
  } catch {}
  serverOnline = false;
  srvDot.className = 'srv-dot offline';
  btnDl.disabled = true;
  urlBar.textContent = L.serverDown;
  return false;
}

/* ── Aktif sekme URL'ini al ──────────────────────────────── */
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || '';
  if (url.startsWith('http')) {
    currentUrl = url;
    try {
      const u = new URL(url);
      urlBar.textContent = u.hostname + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? '…' : '');
    } catch {
      urlBar.textContent = url.slice(0, 50);
    }
  } else {
    urlBar.textContent = L.notSupported;
  }
  checkServer();
});

/* ── Format sekmeleri ────────────────────────────────────── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    renderQualities();
  });
});

function getAudioOpts() {
  return [
    { value: 'mp3-320', label: L.kbps320 },
    { value: 'mp3-192', label: L.kbps192 },
    { value: 'mp3-128', label: L.kbps128 },
  ];
}
function getVideoOpts() {
  return [
    { value: 'mp4-2160', label: L.q4k   },
    { value: 'mp4-1440', label: L.q2k   },
    { value: 'mp4-1080', label: L.q1080 },
    { value: 'mp4-720',  label: L.q720  },
    { value: 'mp4-480',  label: L.q480  },
    { value: 'mp4-360',  label: L.q360  },
  ];
}

function renderQualities() {
  const opts = currentType === 'audio' ? getAudioOpts() : getVideoOpts();
  qualities.innerHTML = opts.map((o, i) => `
    <label class="q-opt">
      <input type="radio" name="q" value="${o.value}" ${i === 0 ? 'checked' : ''}>
      <span>${o.label}</span>
    </label>
  `).join('');
}

/* ── Dil switcher ────────────────────────────────────────── */
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang, true));
});

/* ── WebSocket ───────────────────────────────────────────── */
function connectWS() {
  if (ws && ws.readyState < 2) return;
  ws = new WebSocket(WS_URL);
  ws.addEventListener('message', (e) => {
    try { handleWS(JSON.parse(e.data)); } catch {}
  });
}

function handleWS(msg) {
  if (msg.downloadId !== activeId) return;

  switch (msg.type) {
    case 'filename':
      dlFilename.textContent = msg.filename || L.fileStart;
      break;
    case 'progress': {
      const pct = Math.min(msg.percent || 0, 100);
      progFill.style.width = pct + '%';
      progPct.textContent  = pct.toFixed(1) + '%';
      progSpeed.textContent = msg.speed || '';
      progEta.textContent   = msg.eta ? `ETA ${msg.eta}` : '';
      break;
    }
    case 'status':
      progMsg.textContent = msg.message || '';
      progMsg.className = 'prog-msg';
      break;
    case 'complete':
      progFill.style.width = '100%';
      progFill.className = 'prog-fill done';
      progPct.textContent = '100%';
      progMsg.textContent = L.saved;
      progMsg.className = 'prog-msg ok';
      btnDl.textContent = L.dlBtnDone;
      btnDl.className = 'btn-dl done';
      btnDl.disabled = false;
      activeId = null;
      break;
    case 'error':
      progFill.className = 'prog-fill errored';
      progMsg.textContent = msg.message || L.errDefault;
      progMsg.className = 'prog-msg err';
      btnDl.textContent = L.dlBtnRetry;
      btnDl.className = 'btn-dl errored';
      btnDl.disabled = false;
      activeId = null;
      break;
  }
}

/* ── İndir ───────────────────────────────────────────────── */
btnDl.addEventListener('click', async () => {
  if (!currentUrl) return;

  const formatId = document.querySelector('input[name="q"]:checked')?.value;
  if (!formatId) return;

  btnDl.disabled = true;
  btnDl.textContent = L.dlBtnStart;
  btnDl.className = 'btn-dl';

  progressWrap.hidden = false;
  dlFilename.textContent = L.fileStart;
  progFill.style.width = '0%';
  progFill.className = 'prog-fill';
  progPct.textContent = '0%';
  progSpeed.textContent = '';
  progEta.textContent = '';
  progMsg.textContent = '';
  progMsg.className = 'prog-msg';

  try {
    const res = await fetch(`${SERVER}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl, formatId })
    });
    const data = await res.json();

    if (!res.ok) {
      progMsg.textContent = data.error || L.serverErr;
      progMsg.className = 'prog-msg err';
      btnDl.disabled = false;
      btnDl.textContent = L.dlBtnRetry;
      return;
    }

    activeId = data.downloadId;
    connectWS();
    btnDl.textContent = L.dlBtnDl;

  } catch {
    progMsg.textContent = L.noConn;
    progMsg.className = 'prog-msg err';
    btnDl.disabled = false;
    btnDl.textContent = L.dlBtnRetry;
  }
});

/* ── Init ────────────────────────────────────────────────── */
applyLang('tr');               // İlk render — tab/buton metinleri hemen görünsün
urlBar.textContent = L.detecting;
connectWS();

// Kaydedilmiş dil tercihini yükle
try {
  chrome.storage.local.get('lang', ({ lang }) => {
    applyLang(lang && LANG[lang] ? lang : 'tr');
  });
} catch {
  // Extension context dışında (geliştirme önizlemesi) — TR ile devam et
}
