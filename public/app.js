'use strict';

/* ── WebSocket ─────────────────────────────────────── */
let ws, wsTimer;
function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener('message', (e) => {
    try { handleWSMessage(JSON.parse(e.data)); } catch {}
  });
  ws.addEventListener('close', () => {
    clearTimeout(wsTimer);
    wsTimer = setTimeout(connectWS, 3000);
  });
}
connectWS();

// ── Bildirim izni ─────────────────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

/* ── State ─────────────────────────────────────────── */
let currentFormats = [];
let selectedFormat = null;
let currentType = 'audio';

/* ── DOM refs ───────────────────────────────────────── */
const urlInput       = document.getElementById('urlInput');
const btnPaste       = document.getElementById('btnPaste');
const btnAnalyze     = document.getElementById('btnAnalyze');
const infoCard       = document.getElementById('infoCard');
const thumbnail      = document.getElementById('thumbnail');
const videoTitle     = document.getElementById('videoTitle');
const videoUploader  = document.getElementById('videoUploader');
const videoDuration  = document.getElementById('videoDuration');
const formatGrid     = document.getElementById('formatGrid');
const editorOption   = document.getElementById('editorOption');
const chkSeparateAudio = document.getElementById('chkSeparateAudio');
const btnDownload    = document.getElementById('btnDownload');
const outputDir      = document.getElementById('outputDir');
const btnDefaultDir  = document.getElementById('btnDefaultDir');
const downloadList   = document.getElementById('downloadList');
const downloadsSection = document.getElementById('downloadsSection');
const btnUpdateYtdlp  = document.getElementById('btnUpdateYtdlp');
const logModal        = document.getElementById('logModal');
const logArea         = document.getElementById('logArea');
const btnCloseModal   = document.getElementById('btnCloseModal');
const playlistBanner  = document.getElementById('playlistBanner');
const playlistText    = document.getElementById('playlistText');

/* ── ffmpeg durumu & yt-dlp versiyonu ───────────────── */
let ffmpegAvailable = false;
fetch('/api/ffmpeg-status')
  .then(r => r.json())
  .then(d => { ffmpegAvailable = d.available; updateEditorLabel(); })
  .catch(() => {});

fetch('/api/ytdlp-version')
  .then(r => r.json())
  .then(d => {
    if (d.version) {
      const badge = document.getElementById('versionBadge');
      if (badge) badge.textContent = 'yt-dlp ' + d.version;
    }
  })
  .catch(() => {});

function updateEditorLabel() {
  const label = document.getElementById('editorAudioLabel');
  if (!label) return;
  label.textContent = ffmpegAvailable ? 'Video + Ses (WAV) — editörler için' : 'Video + Ses (M4A) — ffmpeg bulunamadı';
}

/* ── Default dir ────────────────────────────────────── */
fetch('/api/default-dir')
  .then(r => r.json())
  .then(d => { if (outputDir) outputDir.value = d.dir; })
  .catch(() => {});

btnDefaultDir.addEventListener('click', () =>
  fetch('/api/default-dir').then(r => r.json()).then(d => { outputDir.value = d.dir; })
);

/* ── Platform detection ─────────────────────────────── */
const PLATFORMS = [
  { key: 'youtube',   domains: ['youtube.com', 'youtu.be'] },
  { key: 'soundcloud',domains: ['soundcloud.com'] },
  { key: 'twitter',   domains: ['twitter.com', 'x.com'] },
  { key: 'instagram', domains: ['instagram.com'] },
  { key: 'tiktok',    domains: ['tiktok.com', 'vm.tiktok.com'] },
  { key: 'vimeo',     domains: ['vimeo.com'] },
  { key: 'twitch',    domains: ['twitch.tv'] },
];

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PLATFORMS.find(p => p.domains.some(d => host === d || host.endsWith('.' + d)));
  } catch { return null; }
}

function highlightPlatformSidebar(url) {
  const platform = detectPlatform(url);
  document.querySelectorAll('.platform-item').forEach(item => {
    const itemDomains = (item.dataset.url || '').split(',');
    const match = platform && itemDomains.some(d => platform.domains.includes(d.trim()));
    item.classList.toggle('sb-active', match);
  });
}

/* ── Sidebar platform items ─────────────────────────── */
document.querySelectorAll('.platform-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.platform-item').forEach(x => x.classList.remove('sb-active'));
    item.classList.add('sb-active');
    urlInput.focus();
    urlInput.placeholder = `${item.dataset.name} URL yapıştırın…`;
    urlInput.value = '';
    infoCard.hidden = true;
  });
});

/* ── Sidebar format hints ───────────────────────────── */
document.querySelectorAll('.sb-format-hint').forEach(item => {
  item.addEventListener('click', () => {
    const type = item.dataset.type;
    if (!infoCard.hidden) {
      document.querySelectorAll('.fmt-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
      });
      currentType = type;
      renderFormats();
    }
  });
});

/* ── Paste button ───────────────────────────────────── */
btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text.trim();
    if (text.trim()) analyzeUrl();
  } catch { urlInput.focus(); }
});

/* ── Auto-analyze on paste ──────────────────────────── */
urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    if (urlInput.value.trim().startsWith('http')) analyzeUrl();
  }, 80);
});

btnAnalyze.addEventListener('click', analyzeUrl);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeUrl(); });

/* ── Format tabs ────────────────────────────────────── */
document.querySelectorAll('.fmt-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.fmt-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    localStorage.setItem('mf_lastType', currentType);
    renderFormats();
  });
});

/* ── Analyze URL ────────────────────────────────────── */
async function analyzeUrl() {
  const url = urlInput.value.trim();
  if (!url) return showToast('URL giriniz', 'error');
  if (!url.startsWith('http')) return showToast('Geçersiz URL', 'error');

  infoCard.hidden = true;
  selectedFormat = null;

  const btnText = btnAnalyze.querySelector('.btn-text');
  const btnSpin = btnAnalyze.querySelector('.btn-spinner');
  btnAnalyze.disabled = true;
  btnText.hidden = true;
  btnSpin.hidden = false;

  highlightPlatformSidebar(url);

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (!res.ok) return showToast(data.error || 'Hata oluştu', 'error');

    currentFormats = data.formats || [];

    videoTitle.textContent = data.title || 'Başlık bulunamadı';
    videoUploader.textContent = data.uploader ? `📺 ${data.uploader}` : '';
    videoDuration.textContent = data.duration ? `⏱ ${fmtDur(data.duration)}` : '';

    // Thumbnail: TikTok/Instagram CORS sorununu proxy ile çöz
    thumbnail.style.display = '';
    if (data.thumbnail) {
      const platform = detectPlatform(url);
      const needsProxy = platform && ['tiktok', 'instagram'].includes(platform.key);
      thumbnail.src = needsProxy
        ? `/api/thumb?url=${encodeURIComponent(data.thumbnail)}`
        : data.thumbnail;
    } else {
      thumbnail.src = '';
    }
    thumbnail.onerror = () => { thumbnail.style.display = 'none'; };

    // son kullanılan tab tipini geri yükle
    const lastType = localStorage.getItem('mf_lastType') || 'audio';
    document.querySelectorAll('.fmt-tab').forEach(t => t.classList.toggle('active', t.dataset.type === lastType));
    currentType = lastType;
    renderFormats();

    infoCard.hidden = false;
    infoCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Oynatma listesi kontrolü
    if (playlistBanner && isPlaylistUrl(url)) {
      playlistBanner.hidden = false;
      if (playlistText) playlistText.textContent = 'Oynatma listesi algılandı…';
      fetch('/api/playlist-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.ok ? r.json() : null).then(pl => {
        if (pl && playlistText) {
          playlistText.textContent = `${pl.title || 'Oynatma listesi'} — ${pl.count || '?'} video`;
        }
      }).catch(() => {});
    } else if (playlistBanner) {
      playlistBanner.hidden = true;
    }
  } catch {
    showToast('Sunucuya bağlanılamadı', 'error');
  } finally {
    btnAnalyze.disabled = false;
    btnText.hidden = false;
    btnSpin.hidden = true;
  }
}

/* ── Render format buttons ──────────────────────────── */
function renderFormats() {
  formatGrid.innerHTML = '';
  const filtered = currentFormats.filter(f => f.type === currentType);
  selectedFormat = null;
  btnDownload.disabled = true;
  editorOption.hidden = currentType !== 'video';
  chkSeparateAudio.checked = false;

  filtered.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'format-btn';
    btn.textContent = f.label;
    btn.dataset.id = f.id;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFormat = f.id;
      localStorage.setItem('mf_lastFormat', f.id);
      btnDownload.disabled = false;
    });
    formatGrid.appendChild(btn);
  });

  // Son kullanılan formatı geri yükle, yoksa ilki
  const lastFormat = localStorage.getItem('mf_lastFormat');
  const toSelect = (lastFormat && formatGrid.querySelector(`[data-id="${lastFormat}"]`))
    || formatGrid.querySelector('.format-btn');
  if (toSelect) {
    toSelect.classList.add('selected');
    selectedFormat = toSelect.dataset.id;
    btnDownload.disabled = false;
  }
}

/* ── Download ───────────────────────────────────────── */
btnDownload.addEventListener('click', async () => {
  if (!selectedFormat) return showToast('Format seçiniz', 'error');
  const url = urlInput.value.trim();
  if (!url) return;

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formatId: selectedFormat,
        outputDir: outputDir.value || null,
        separateAudio: chkSeparateAudio.checked
      })
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'İndirme başlatılamadı', 'error');

    addDownloadItem(data.downloadId, chkSeparateAudio.checked ? '🎬 Video' : null);
    if (data.audioDownloadId) addDownloadItem(data.audioDownloadId, '🎵 Ses');

    showToast('İndirme başlatıldı!', 'success');
  } catch {
    showToast('Sunucu hatası', 'error');
  }
});

/* ── Download items ─────────────────────────────────── */
const dlItems = new Map();
const dlDirs  = new Map();

function addDownloadItem(id, label = null) {
  downloadsSection.hidden = false;
  const item = document.createElement('div');
  item.className = 'dl-item';
  item.id = `dl-${id}`;

  const labelHtml = label ? `<span class="dl-label-tag">${label}</span>` : '';
  item.innerHTML = `
    <div class="dl-header-row">
      <span class="dl-filename">${labelHtml}Başlatılıyor…</span>
      <span class="dl-status-pill running">İndiriliyor</span>
    </div>
    <div class="dl-progress-track">
      <div class="dl-progress-fill" style="width:0%"></div>
    </div>
    <div class="dl-stats">
      <span class="dl-percent">0%</span>
      <span class="dl-speed"></span>
      <span class="dl-eta"></span>
      <span class="dl-size"></span>
    </div>
    <div class="dl-message"></div>
    <button class="dl-cancel-btn" data-id="${id}" title="İptal">✕</button>
  `;
  downloadList.prepend(item);
  dlItems.set(id, item);
  dlDirs.set(id, outputDir.value);

  item.querySelector('.dl-cancel-btn').addEventListener('click', () => {
    fetch(`/api/cancel/${id}`, { method: 'POST' });
  });
}

/* ── Bildirim ───────────────────────────────────────── */
function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

/* ── Geçmiş ─────────────────────────────────────────── */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    renderHistory(await res.json());
  } catch {}
}

function renderHistory(items) {
  const histList = document.getElementById('historyList');
  if (!histList) return;
  if (!items.length) {
    histList.innerHTML = '<div class="hist-empty">Henüz indirme yok</div>';
    return;
  }
  histList.innerHTML = items.slice(0, 30).map(item => {
    const d = new Date(item.date);
    const dateStr = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    const label = item.title || item.filename || 'İndirme';
    const short = label.length > 26 ? label.substring(0, 26) + '…' : label;
    return `<div class="hist-item" title="${escapeHtml(label)}">
      <span class="hist-name">${escapeHtml(short)}</span>
      <span class="hist-date">${dateStr}</span>
    </div>`;
  }).join('');
}

const btnClearHistory = document.getElementById('btnClearHistory');
if (btnClearHistory) {
  btnClearHistory.addEventListener('click', async () => {
    await fetch('/api/history/clear', { method: 'POST' });
    renderHistory([]);
  });
}

/* ── Playlist ────────────────────────────────────────── */
function isPlaylistUrl(url) {
  return url.includes('list=') || url.includes('/playlist') || url.includes('/sets/');
}

/* ── WebSocket messages ─────────────────────────────── */
function handleWSMessage(msg) {
  const { type, downloadId } = msg;

  if (type === 'log') { logArea.textContent += msg.message; return; }
  if (type === 'ytdlp-version') {
    const badge = document.getElementById('versionBadge');
    if (badge) badge.textContent = 'yt-dlp ' + msg.version;
    return;
  }
  if (!downloadId) return;

  const item = dlItems.get(downloadId);
  if (!item) return;

  switch (type) {
    case 'filename': {
      const lbl = item.querySelector('.dl-label-tag');
      const fn = item.querySelector('.dl-filename');
      fn.textContent = '';
      if (lbl) fn.appendChild(lbl);
      fn.append(msg.filename);
      break;
    }
    case 'progress': {
      const pct = Math.min(msg.percent || 0, 100);
      item.querySelector('.dl-progress-fill').style.width = pct + '%';
      item.querySelector('.dl-percent').textContent = pct.toFixed(1) + '%';
      item.querySelector('.dl-speed').textContent = msg.speed || '';
      item.querySelector('.dl-eta').textContent = msg.eta ? `ETA ${msg.eta}` : '';
      item.querySelector('.dl-size').textContent = msg.size || '';
      break;
    }
    case 'status': {
      item.querySelector('.dl-message').textContent = msg.message || '';
      break;
    }
    case 'complete': {
      item.classList.add('complete');
      item.querySelector('.dl-progress-fill').style.width = '100%';
      item.querySelector('.dl-percent').textContent = '100%';
      const pill = item.querySelector('.dl-status-pill');
      pill.className = 'dl-status-pill complete';
      pill.textContent = 'Tamamlandı';
      const msgEl = item.querySelector('.dl-message');
      msgEl.textContent = '✓ Dosya kaydedildi';
      msgEl.className = 'dl-message ok-msg';
      // "Klasörde Göster" butonu
      const openBtn = document.createElement('button');
      openBtn.className = 'dl-open-btn';
      openBtn.textContent = '📂 Klasörde Göster';
      openBtn.addEventListener('click', () => {
        fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: dlDirs.get(downloadId) || outputDir.value || '' })
        }).catch(() => {});
      });
      msgEl.insertAdjacentElement('afterend', openBtn);
      // İptal → Kapat butonuna çevir
      const cancelBtn = item.querySelector('.dl-cancel-btn');
      if (cancelBtn) {
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dl-cancel-btn';
        dismissBtn.title = 'Kapat';
        dismissBtn.textContent = '✕';
        dismissBtn.addEventListener('click', () => { item.remove(); dlItems.delete(downloadId); dlDirs.delete(downloadId); });
        cancelBtn.replaceWith(dismissBtn);
      }
      const fnText = item.querySelector('.dl-filename')?.textContent || '';
      showNotification('İndirme tamamlandı!', fnText);
      showToast('İndirme tamamlandı!', 'success');
      loadHistory();
      break;
    }
    case 'error': {
      item.classList.add('error');
      const pill = item.querySelector('.dl-status-pill');
      pill.className = 'dl-status-pill error';
      pill.textContent = 'Hata';
      const msgEl = item.querySelector('.dl-message');
      msgEl.textContent = msg.message || 'Hata oluştu';
      msgEl.className = 'dl-message error-msg';
      const errBtn = item.querySelector('.dl-cancel-btn');
      if (errBtn) {
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dl-cancel-btn';
        dismissBtn.title = 'Kapat';
        dismissBtn.textContent = '✕';
        dismissBtn.addEventListener('click', () => { item.remove(); dlItems.delete(downloadId); dlDirs.delete(downloadId); });
        errBtn.replaceWith(dismissBtn);
      }
      showToast('İndirme başarısız', 'error');
      break;
    }
    case 'cancelled': {
      item.classList.add('cancelled');
      const pill = item.querySelector('.dl-status-pill');
      pill.className = 'dl-status-pill cancelled';
      pill.textContent = 'İptal';
      const cxlBtn = item.querySelector('.dl-cancel-btn');
      if (cxlBtn) {
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dl-cancel-btn';
        dismissBtn.title = 'Kapat';
        dismissBtn.textContent = '✕';
        dismissBtn.addEventListener('click', () => { item.remove(); dlItems.delete(downloadId); dlDirs.delete(downloadId); });
        cxlBtn.replaceWith(dismissBtn);
      }
      break;
    }
  }
}

/* ── yt-dlp update ──────────────────────────────────── */
btnUpdateYtdlp.addEventListener('click', () => {
  logModal.hidden = false;
  logArea.textContent = 'Güncelleme başlatılıyor…\n';
  fetch('/api/update-ytdlp', { method: 'POST' });
});
btnCloseModal.addEventListener('click', () => { logModal.hidden = true; });
logModal.addEventListener('click', e => { if (e.target === logModal) logModal.hidden = true; });

/* ── Helpers ────────────────────────────────────────── */
function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${m}:${String(ss).padStart(2,'0')}`;
}

let toastTimer;
function showToast(msg, type = 'success') {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => {
    t.style.transition = 'opacity .25s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 250);
  }, 3000);
}

// İndirme geçmişini yükle
loadHistory();
