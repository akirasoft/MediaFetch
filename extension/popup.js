'use strict';

/* Bu popup artık sunucuyla doğrudan konuşmuyor: indirmeyi background.js
   (service worker) yürütüyor. Popup kapansa bile indirme devam eder ve
   uzak sunucudaki dosya bilgisayara çekilir. */

/* ── Çeviri tablosu ─────────────────────────────────────── */
const LANG = {
  tr: {
    detecting:    'Sayfa algılanıyor…',
    notSupported: 'Bu sayfada çalışmaz (http/https gerekli)',
    serverDown:   '⚠ Sunucu çalışmıyor — start.bat ile başlatın',
    serverDownRem:'⚠ Sunucuya ulaşılamıyor — adresi ⚙ ile kontrol edin',
    serverAuth:   '⚠ Erişim anahtarı hatalı — ⚙ ile düzeltin',
    srvTitle:     'Sunucu bağlantısı',
    settings:     'Sunucu ayarları',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ İndir',
    dlBtnStart:   '↻ Başlatılıyor…',
    dlBtnDl:      '⬇ İndiriliyor…',
    dlBtnDone:    '⬇ Tekrar İndir',
    dlBtnRetry:   '⬇ Tekrar Dene',
    fileStart:    'Başlatılıyor…',
    saved:        '✓ Kaydedildi',
    savingToPc:   'Bilgisayara aktarılıyor…',
    savedToPc:    '✓ Bilgisayarına indirildi',
    readyOnSrv:   '✓ Sunucuda hazır',
    saveFailed:   'Tarayıcı indirmesi başarısız — “Bilgisayarıma indir”i deneyin',
    errDefault:   'Hata oluştu',
    noConn:       'Sunucuya bağlanılamadı',
    serverErr:    'Sunucu hatası',
    authErr:      'Erişim anahtarı gerekli/hatalı',
    /* Ayarlar */
    srvUrlLabel:  'Sunucu adresi',
    tokenLabel:   'Erişim anahtarı (varsa)',
    autoSaveLabel:'Bitince dosyayı bilgisayarıma indir',
    saveCfg:      'Kaydet',
    testCfg:      'Test et',
    presetLocal:  'Local (3434)',
    presetRemote: 'Sunucu (8422)',
    saveNow:      '⬇ Bilgisayarıma indir',
    cfgSaved:     '✓ Kaydedildi',
    testing:      'Deneniyor…',
    testOk:       '✓ Sunucu erişilebilir',
    testAuth:     '✗ Anahtar hatalı',
    testFail:     '✗ Sunucuya ulaşılamadı',
    permDenied:   '✗ Bu adrese erişim izni verilmedi',
    remoteTag:    'SUNUCU',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  },
  en: {
    detecting:    'Detecting page…',
    notSupported: 'Not supported here (http/https required)',
    serverDown:   '⚠ Server not running — launch start.bat',
    serverDownRem:'⚠ Server unreachable — check the address under ⚙',
    serverAuth:   '⚠ Wrong access token — fix it under ⚙',
    srvTitle:     'Server connection',
    settings:     'Server settings',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ Download',
    dlBtnStart:   '↻ Starting…',
    dlBtnDl:      '⬇ Downloading…',
    dlBtnDone:    '⬇ Download Again',
    dlBtnRetry:   '⬇ Retry',
    fileStart:    'Starting…',
    saved:        '✓ Saved',
    savingToPc:   'Transferring to your computer…',
    savedToPc:    '✓ Saved to your computer',
    readyOnSrv:   '✓ Ready on the server',
    saveFailed:   'Browser download failed — try “Save to my computer”',
    errDefault:   'An error occurred',
    noConn:       'Could not connect to server',
    serverErr:    'Server error',
    authErr:      'Access token missing or wrong',
    srvUrlLabel:  'Server address',
    tokenLabel:   'Access token (if any)',
    autoSaveLabel:'Save the finished file to my computer',
    saveCfg:      'Save',
    testCfg:      'Test',
    presetLocal:  'Local (3434)',
    presetRemote: 'Server (8422)',
    saveNow:      '⬇ Save to my computer',
    cfgSaved:     '✓ Saved',
    testing:      'Testing…',
    testOk:       '✓ Server reachable',
    testAuth:     '✗ Wrong token',
    testFail:     '✗ Server unreachable',
    permDenied:   '✗ Permission for this address was denied',
    remoteTag:    'REMOTE',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  },
  es: {
    detecting:    'Detectando página…',
    notSupported: 'No compatible aquí (se requiere http/https)',
    serverDown:   '⚠ Servidor inactivo — ejecuta start.bat',
    serverDownRem:'⚠ Servidor inaccesible — revisa la dirección en ⚙',
    serverAuth:   '⚠ Clave de acceso incorrecta — corrígela en ⚙',
    srvTitle:     'Conexión al servidor',
    settings:     'Ajustes del servidor',
    tabAudio:     '🎵 MP3',
    tabVideo:     '🎬 MP4',
    dlBtn:        '⬇ Descargar',
    dlBtnStart:   '↻ Iniciando…',
    dlBtnDl:      '⬇ Descargando…',
    dlBtnDone:    '⬇ Descargar otra vez',
    dlBtnRetry:   '⬇ Reintentar',
    fileStart:    'Iniciando…',
    saved:        '✓ Guardado',
    savingToPc:   'Transfiriendo a tu ordenador…',
    savedToPc:    '✓ Guardado en tu ordenador',
    readyOnSrv:   '✓ Listo en el servidor',
    saveFailed:   'Descarga del navegador fallida — prueba «Guardar en mi ordenador»',
    errDefault:   'Ocurrió un error',
    noConn:       'No se pudo conectar al servidor',
    serverErr:    'Error del servidor',
    authErr:      'Clave de acceso ausente o incorrecta',
    srvUrlLabel:  'Dirección del servidor',
    tokenLabel:   'Clave de acceso (si hay)',
    autoSaveLabel:'Guardar el archivo terminado en mi ordenador',
    saveCfg:      'Guardar',
    testCfg:      'Probar',
    presetLocal:  'Local (3434)',
    presetRemote: 'Servidor (8422)',
    saveNow:      '⬇ Guardar en mi ordenador',
    cfgSaved:     '✓ Guardado',
    testing:      'Probando…',
    testOk:       '✓ Servidor accesible',
    testAuth:     '✗ Clave incorrecta',
    testFail:     '✗ Servidor inaccesible',
    permDenied:   '✗ Permiso denegado para esta dirección',
    remoteTag:    'SERVIDOR',
    q4k:   '4K (2160p)', q2k:  '2K (1440p)', q1080: '1080p HD',
    q720:  '720p HD',    q480: '480p',        q360:  '360p',
    kbps320: '320 kbps', kbps192: '192 kbps', kbps128: '128 kbps',
  }
};

let currentLang = 'tr';
let L = LANG.tr;

/* Ayarlar panelindeki hazır adresler. Sunucu IP'si burada tek yerde durur. */
const PRESET_LOCAL  = 'http://localhost:3434';
const PRESET_REMOTE = 'http://SUNUCU_IP:8422';

/* ── DOM ──────────────────────────────────────────────────── */
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
const btnSaveNow   = document.getElementById('btnSaveNow');
const btnSettings  = document.getElementById('btnSettings');
const settingsBox  = document.getElementById('settings');
const inpServer    = document.getElementById('inpServer');
const inpToken     = document.getElementById('inpToken');
const chkAutoSave  = document.getElementById('chkAutoSave');
const btnSaveCfg   = document.getElementById('btnSaveCfg');
const btnTestCfg   = document.getElementById('btnTestCfg');
const setMsg       = document.getElementById('setMsg');

let currentUrl   = '';
let currentType  = 'audio';
let activeId     = null;
let serverOnline = false;
let serverReason = '';
let isRemote     = false;
let cfg          = { serverUrl: PRESET_LOCAL, token: '', autoSave: true };

const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

/* ── Dil ──────────────────────────────────────────────────── */
function applyLang(lang, save) {
  currentLang = lang;
  L = LANG[lang] || LANG.tr;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (L[key]) el.textContent = L[key];
  });
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  srvDot.title = L.srvTitle;
  btnSettings.title = L.settings;
  renderUrlBar();
  renderQualities();

  if (save) { try { chrome.storage.local.set({ lang }); } catch {} }
}

/* ── Durum göstergeleri ───────────────────────────────────── */
function renderUrlBar() {
  if (!serverOnline) {
    urlBar.textContent = serverReason === 'auth' ? L.serverAuth
      : isRemote ? L.serverDownRem : L.serverDown;
    return;
  }
  urlBar.textContent = '';
  if (isRemote) {
    const tag = document.createElement('span');
    tag.className = 'srv-tag';
    tag.textContent = L.remoteTag;
    urlBar.appendChild(tag);
  }
  const text = document.createElement('span');
  if (!currentUrl) {
    text.textContent = L.detecting;
  } else {
    try {
      const u = new URL(currentUrl);
      text.textContent = u.hostname + u.pathname.slice(0, 34) + (u.pathname.length > 34 ? '…' : '');
    } catch { text.textContent = currentUrl.slice(0, 46); }
  }
  urlBar.appendChild(text);
}

function renderServerState() {
  srvDot.className = 'srv-dot ' + (serverOnline ? 'online' : 'offline');
  btnDl.disabled = !serverOnline || !currentUrl || activeId !== null;
  renderUrlBar();
}

/* ── Format seçenekleri ───────────────────────────────────── */
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

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    renderQualities();
  });
});

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang, true));
});

/* ── Ayarlar paneli ───────────────────────────────────────── */
btnSettings.addEventListener('click', () => {
  const show = settingsBox.hidden;
  settingsBox.hidden = !show;
  btnSettings.classList.toggle('active', show);
  if (show) inpServer.focus();
});

document.getElementById('presetLocal').addEventListener('click', () => {
  inpServer.value = PRESET_LOCAL;
  inpToken.value = '';
});
document.getElementById('presetRemote').addEventListener('click', () => {
  inpServer.value = PRESET_REMOTE;
});

function setStatus(text, kind) {
  setMsg.textContent = text || '';
  setMsg.className = 'set-msg' + (kind ? ' ' + kind : '');
}

// Adres yeni bir host ise Chrome'un host izni gerekir; istek kullanıcı
// tıklamasıyla yapılmalı, bu yüzden Kaydet/Test içinden çağrılıyor.
async function ensureHostPermission(serverUrl) {
  let origin;
  try {
    const u = new URL(/^https?:\/\//i.test(serverUrl) ? serverUrl : 'http://' + serverUrl);
    origin = `${u.protocol}//${u.hostname}/*`;   // port yazılmaz: tüm portları kapsar
  } catch { return false; }
  try {
    if (await chrome.permissions.contains({ origins: [origin] })) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return true;   // izin API'si yoksa host_permissions'a güven
  }
}

btnSaveCfg.addEventListener('click', async () => {
  const serverUrl = inpServer.value.trim() || PRESET_LOCAL;
  if (!await ensureHostPermission(serverUrl)) { setStatus(L.permDenied, 'err'); return; }

  setStatus(L.testing);
  const res = await send({
    cmd: 'saveCfg',
    serverUrl,
    token: inpToken.value,
    autoSave: chkAutoSave.checked,
  });
  if (!res) { setStatus(L.testFail, 'err'); return; }

  cfg = res.cfg;
  isRemote = !!res.remote;
  inpServer.value = cfg.serverUrl;
  applyServerHealth(res.server);
  setStatus(serverOnline ? L.cfgSaved + ' · ' + L.testOk
    : serverReason === 'auth' ? L.testAuth : L.cfgSaved + ' · ' + L.testFail,
    serverOnline ? 'ok' : 'err');
});

btnTestCfg.addEventListener('click', async () => {
  const serverUrl = inpServer.value.trim() || PRESET_LOCAL;
  if (!await ensureHostPermission(serverUrl)) { setStatus(L.permDenied, 'err'); return; }
  setStatus(L.testing);
  // Test, kaydedilmiş ayara göre çalışır — alanları önce kaydedip deneriz.
  const res = await send({
    cmd: 'saveCfg', serverUrl, token: inpToken.value, autoSave: chkAutoSave.checked,
  });
  if (!res) { setStatus(L.testFail, 'err'); return; }
  cfg = res.cfg;
  isRemote = !!res.remote;
  applyServerHealth(res.server);
  setStatus(serverOnline ? L.testOk : serverReason === 'auth' ? L.testAuth : L.testFail,
    serverOnline ? 'ok' : 'err');
});

function applyServerHealth(health) {
  serverOnline = !!(health && health.online);
  serverReason = (health && health.reason) || '';
  renderServerState();
}

/* ── İş durumu ────────────────────────────────────────────── */
function renderJob(job) {
  if (!job || (activeId && job.id !== activeId)) return;
  activeId = job.id;
  progressWrap.hidden = false;

  dlFilename.textContent = job.filename || L.fileStart;
  const pct = Math.min(job.percent || 0, 100);
  progFill.style.width = pct + '%';
  progPct.textContent = pct.toFixed(1) + '%';
  progSpeed.textContent = job.speed || '';
  progEta.textContent = job.eta ? `ETA ${job.eta}` : '';

  btnSaveNow.hidden = true;
  btnSaveNow.dataset.id = job.id;

  switch (job.status) {
    case 'starting':
      btnDl.textContent = L.dlBtnStart;
      btnDl.disabled = true;
      progMsg.textContent = '';
      progMsg.className = 'prog-msg';
      break;
    case 'running':
    case 'processing':
      btnDl.textContent = L.dlBtnDl;
      btnDl.disabled = true;
      progFill.className = 'prog-fill';
      progMsg.textContent = job.msg || '';
      progMsg.className = 'prog-msg';
      break;
    case 'saving':
      progFill.className = 'prog-fill';
      progPct.textContent = '100%';
      progFill.style.width = '100%';
      progMsg.textContent = L.savingToPc;
      progMsg.className = 'prog-msg';
      break;
    case 'complete':
    case 'saved':
      progFill.style.width = '100%';
      progFill.className = 'prog-fill done';
      progPct.textContent = '100%';
      progMsg.className = 'prog-msg ok';
      if (job.status === 'saved') progMsg.textContent = L.savedToPc;
      else if (!isRemote) progMsg.textContent = L.saved;
      else if (job.saveError) { progMsg.textContent = L.saveFailed; progMsg.className = 'prog-msg err'; }
      else progMsg.textContent = L.readyOnSrv;
      btnSaveNow.hidden = !(isRemote && job.fileUrl && job.status !== 'saved');
      btnDl.textContent = L.dlBtnDone;
      btnDl.className = 'btn-dl done';
      btnDl.disabled = !currentUrl;
      activeId = null;
      break;
    case 'error':
      progFill.className = 'prog-fill errored';
      progMsg.textContent = job.error || L.errDefault;
      progMsg.className = 'prog-msg err';
      btnDl.textContent = L.dlBtnRetry;
      btnDl.className = 'btn-dl errored';
      btnDl.disabled = !currentUrl;
      activeId = null;
      break;
    case 'cancelled':
      progMsg.textContent = '';
      btnDl.textContent = L.dlBtn;
      btnDl.className = 'btn-dl';
      btnDl.disabled = !currentUrl;
      activeId = null;
      break;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'job') renderJob(msg.job);
  else if (msg.type === 'ws') { /* canlı bağlantı; nokta health'e göre */ }
});

/* ── İndir ────────────────────────────────────────────────── */
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
  btnSaveNow.hidden = true;

  const res = await send({ cmd: 'start', url: currentUrl, formatId });
  if (!res || !res.ok) {
    progMsg.textContent = !res ? L.noConn
      : res.error === 'auth' ? L.authErr
      : res.error === 'server' ? L.serverErr
      : res.error || L.serverErr;
    progMsg.className = 'prog-msg err';
    btnDl.disabled = false;
    btnDl.textContent = L.dlBtnRetry;
    return;
  }
  activeId = res.ids[0];
  btnDl.textContent = L.dlBtnDl;
});

btnSaveNow.addEventListener('click', async () => {
  const id = btnSaveNow.dataset.id;
  if (id) await send({ cmd: 'saveNow', id });
});

/* ── Açılış ───────────────────────────────────────────────── */
applyLang('tr');

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || '';
  if (url.startsWith('http')) currentUrl = url;
  renderServerState();
});

(async () => {
  try {
    const { lang } = await chrome.storage.local.get('lang');
    if (lang && LANG[lang]) applyLang(lang);
  } catch {}

  const state = await send({ cmd: 'getState' });
  if (!state) { applyServerHealth({ online: false }); return; }

  cfg = state.cfg;
  isRemote = !!state.remote;
  inpServer.value = cfg.serverUrl;
  inpToken.value = cfg.token;
  chkAutoSave.checked = cfg.autoSave !== false;
  applyServerHealth(state.server);

  // Devam eden ya da az önce bitmiş iş varsa onu göster.
  const jobsList = state.jobs || [];
  const live = jobsList.find(j => ['starting', 'running', 'processing', 'saving'].includes(j.status));
  const shown = live || jobsList[0];
  if (shown) {
    activeId = shown.id;      // renderJob filtreler; bitmişse kendisi sıfırlar
    renderJob(shown);
  }
})();
