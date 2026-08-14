'use strict';

/* ── i18n ───────────────────────────────────────────── */
const LANGS = {
  tr: {
    nav_discover: 'Keşfet', nav_downloads: 'İndirmeler',
    sb_platforms: 'Platformlar', sb_format: 'Format', sb_history: 'Son İndirmeler',
    sb_saveto: 'Kayıt Yeri', hist_empty: 'Henüz indirme yok',
    fmt_audio_hint: 'MP3 — Ses', fmt_video_hint: 'MP4 — Video',
    hero_meta_sites: '1.000+ site desteklenir',
    hero_meta_ffmpeg: 'ffmpeg birleştirme aktif', hero_meta_ffmpeg_off: 'ffmpeg bulunamadı',
    hero_h1: 'Müzik & Video', hero_h2: 'İndirin.',
    hero_sub_1: 'YouTube, SoundCloud, Instagram ve daha fazlasından',
    hero_sub_2: 'yüksek kalite, tek tıkla.',
    url_placeholder: 'URL yapıştırın — YouTube, SoundCloud, Twitter/X, Instagram…',
    url_paste_here: 'URL yapıştırın…',
    btn_paste_title: 'Panodan yapıştır', btn_analyze: 'Analiz Et',
    tab_audio: '🎵 Müzik (MP3)', tab_video: '🎬 Video (MP4)',
    editor_strong: 'Editörler için', editor_desc: ' — Ses ve videoyu ayrı dosya olarak indir',
    editor_wav: 'Video + Ses (WAV) — editörler için', editor_m4a: 'Video + Ses (M4A) — ffmpeg bulunamadı',
    btn_download: '⬇ İndir', dl_section_title: 'İndirmeler',
    dl_starting: 'Başlatılıyor…', dl_running: 'İndiriliyor', dl_complete: 'Tamamlandı',
    dl_error: 'Hata', dl_cancelled: 'İptal',
    dl_saved: '✓ Dosya kaydedildi', dl_open_folder: '📂 Klasörde Göster',
    dl_cancel_title: 'İptal', dl_dismiss_title: 'Kapat',
    toast_enter_url: 'URL giriniz', toast_invalid_url: 'Geçersiz URL',
    toast_select_format: 'Format seçiniz', toast_dl_started: 'İndirme başlatıldı!',
    toast_dl_failed: 'İndirme başarısız', toast_dl_error: 'İndirme başlatılamadı',
    toast_server_error: 'Sunucu hatası', toast_no_server: 'Sunucuya bağlanılamadı',
    notif_dl_complete: 'İndirme tamamlandı!',
    playlist_detected: 'Oynatma listesi algılandı…', playlist_label: 'Oynatma Listesi',
    // Settings
    btn_settings_title: 'Ayarlar',
    settings_title: 'Ayarlar',
    settings_updates: 'yt-dlp Güncellemeleri',
    version_current: 'Mevcut', version_latest: 'Son sürüm',
    version_up_to_date: '✓ Güncel',
    btn_check_updates: 'Güncellemeleri Kontrol Et',
    btn_install_update: '⬇ Güncellemeyi Yükle',
    setting_auto_update: 'Başlangıçta güncellemeleri otomatik kontrol et',
    settings_privacy_note: 'Güncellemeler doğrudan github.com/yt-dlp adresine bağlanır — aracı sunucu yok. Mevcut binary\'yi değiştirmeden önce SHA256 ile doğrulanır.',
    update_checking: 'Kontrol ediliyor…',
    update_available_toast: 'yt-dlp güncellemesi mevcut → Ayarlar',
    update_already_latest: 'Zaten güncel.',
    update_complete_toast: 'yt-dlp güncellendi!',
    update_error_toast: 'Güncelleme başarısız',
  },
  en: {
    nav_discover: 'Discover', nav_downloads: 'Downloads',
    sb_platforms: 'Platforms', sb_format: 'Format', sb_history: 'Recent Downloads',
    sb_saveto: 'Save to', hist_empty: 'No downloads yet',
    fmt_audio_hint: 'MP3 — Audio', fmt_video_hint: 'MP4 — Video',
    hero_meta_sites: '1,000+ sites supported',
    hero_meta_ffmpeg: 'ffmpeg merge active', hero_meta_ffmpeg_off: 'ffmpeg not found',
    hero_h1: 'Music & Video', hero_h2: 'Download.',
    hero_sub_1: 'High quality from YouTube, SoundCloud, Instagram and more',
    hero_sub_2: '— one click.',
    url_placeholder: 'Paste URL — YouTube, SoundCloud, Twitter/X, Instagram…',
    url_paste_here: 'paste URL here…',
    btn_paste_title: 'Paste from clipboard', btn_analyze: 'Analyze',
    tab_audio: '🎵 Music (MP3)', tab_video: '🎬 Video (MP4)',
    editor_strong: 'For editors', editor_desc: ' — Download audio and video as separate files',
    editor_wav: 'Video + Audio (WAV) — for editors', editor_m4a: 'Video + Audio (M4A) — ffmpeg not found',
    btn_download: '⬇ Download', dl_section_title: 'Downloads',
    dl_starting: 'Starting…', dl_running: 'Downloading', dl_complete: 'Complete',
    dl_error: 'Error', dl_cancelled: 'Cancelled',
    dl_saved: '✓ File saved', dl_open_folder: '📂 Show in folder',
    dl_cancel_title: 'Cancel', dl_dismiss_title: 'Close',
    toast_enter_url: 'Enter a URL', toast_invalid_url: 'Invalid URL',
    toast_select_format: 'Select a format', toast_dl_started: 'Download started!',
    toast_dl_failed: 'Download failed', toast_dl_error: 'Could not start download',
    toast_server_error: 'Server error', toast_no_server: 'Cannot connect to server',
    notif_dl_complete: 'Download complete!',
    playlist_detected: 'Playlist detected…', playlist_label: 'Playlist',
    // Settings
    btn_settings_title: 'Settings',
    settings_title: 'Settings',
    settings_updates: 'yt-dlp Updates',
    version_current: 'Current', version_latest: 'Latest',
    version_up_to_date: '✓ Up to date',
    btn_check_updates: 'Check for Updates',
    btn_install_update: '⬇ Install Update',
    setting_auto_update: 'Automatically check for updates on startup',
    settings_privacy_note: 'Updates connect directly to github.com/yt-dlp — no intermediary server. Binary is verified with SHA256 before replacing.',
    update_checking: 'Checking…',
    update_available_toast: 'yt-dlp update available → Settings',
    update_already_latest: 'Already up to date.',
    update_complete_toast: 'yt-dlp updated!',
    update_error_toast: 'Update failed',
  },
  es: {
    nav_discover: 'Explorar', nav_downloads: 'Descargas',
    sb_platforms: 'Plataformas', sb_format: 'Formato', sb_history: 'Descargas recientes',
    sb_saveto: 'Guardar en', hist_empty: 'Sin descargas aún',
    fmt_audio_hint: 'MP3 — Audio', fmt_video_hint: 'MP4 — Vídeo',
    hero_meta_sites: '1.000+ sitios compatibles',
    hero_meta_ffmpeg: 'ffmpeg activo', hero_meta_ffmpeg_off: 'ffmpeg no encontrado',
    hero_h1: 'Música & Vídeo', hero_h2: 'Descarga.',
    hero_sub_1: 'Alta calidad de YouTube, SoundCloud, Instagram y más',
    hero_sub_2: '— un solo clic.',
    url_placeholder: 'Pega la URL — YouTube, SoundCloud, Twitter/X, Instagram…',
    url_paste_here: 'pegar URL aquí…',
    btn_paste_title: 'Pegar del portapapeles', btn_analyze: 'Analizar',
    tab_audio: '🎵 Música (MP3)', tab_video: '🎬 Vídeo (MP4)',
    editor_strong: 'Para editores', editor_desc: ' — Descarga audio y vídeo como archivos separados',
    editor_wav: 'Vídeo + Audio (WAV) — para editores', editor_m4a: 'Vídeo + Audio (M4A) — ffmpeg no encontrado',
    btn_download: '⬇ Descargar', dl_section_title: 'Descargas',
    dl_starting: 'Iniciando…', dl_running: 'Descargando', dl_complete: 'Completado',
    dl_error: 'Error', dl_cancelled: 'Cancelado',
    dl_saved: '✓ Archivo guardado', dl_open_folder: '📂 Mostrar en carpeta',
    dl_cancel_title: 'Cancelar', dl_dismiss_title: 'Cerrar',
    toast_enter_url: 'Introduce una URL', toast_invalid_url: 'URL no válida',
    toast_select_format: 'Selecciona un formato', toast_dl_started: '¡Descarga iniciada!',
    toast_dl_failed: 'Descarga fallida', toast_dl_error: 'No se pudo iniciar la descarga',
    toast_server_error: 'Error del servidor', toast_no_server: 'No se puede conectar al servidor',
    notif_dl_complete: '¡Descarga completada!',
    playlist_detected: 'Lista detectada…', playlist_label: 'Lista de reproducción',
    // Settings
    btn_settings_title: 'Configuración',
    settings_title: 'Configuración',
    settings_updates: 'Actualizaciones de yt-dlp',
    version_current: 'Actual', version_latest: 'Última',
    version_up_to_date: '✓ Actualizado',
    btn_check_updates: 'Buscar actualizaciones',
    btn_install_update: '⬇ Instalar actualización',
    setting_auto_update: 'Comprobar actualizaciones automáticamente al iniciar',
    settings_privacy_note: 'Las actualizaciones se conectan directamente a github.com/yt-dlp — sin servidor intermediario. El binario se verifica con SHA256 antes de reemplazarlo.',
    update_checking: 'Comprobando…',
    update_available_toast: 'Actualización de yt-dlp disponible → Configuración',
    update_already_latest: 'Ya está actualizado.',
    update_complete_toast: '¡yt-dlp actualizado!',
    update_error_toast: 'Error al actualizar',
  }
};

let currentLang = localStorage.getItem('mf_lang') || 'tr';

function t(key) {
  return (LANGS[currentLang] || LANGS.tr)[key] || key;
}

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('mf_lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  updateEditorLabel();

  const heroStatus = document.getElementById('heroFfmpegStatus');
  if (heroStatus) heroStatus.textContent = ffmpegAvailable ? t('hero_meta_ffmpeg') : t('hero_meta_ffmpeg_off');

  const histEmpty = document.querySelector('.hist-empty');
  if (histEmpty) histEmpty.textContent = t('hist_empty');
}

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

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

/* ── State ─────────────────────────────────────────── */
let currentFormats = [];
let selectedFormat = null;
let currentType = 'audio';
let ffmpegAvailable = false;

/* ── DOM refs ───────────────────────────────────────── */
const urlInput         = document.getElementById('urlInput');
const btnPaste         = document.getElementById('btnPaste');
const btnAnalyze       = document.getElementById('btnAnalyze');
const infoCard         = document.getElementById('infoCard');
const thumbnail        = document.getElementById('thumbnail');
const videoTitle       = document.getElementById('videoTitle');
const videoUploader    = document.getElementById('videoUploader');
const videoDuration    = document.getElementById('videoDuration');
const formatGrid       = document.getElementById('formatGrid');
const editorOption     = document.getElementById('editorOption');
const chkSeparateAudio = document.getElementById('chkSeparateAudio');
const btnDownload      = document.getElementById('btnDownload');
const outputDir        = document.getElementById('outputDir');
const btnDefaultDir    = document.getElementById('btnDefaultDir');
const downloadList     = document.getElementById('downloadList');
const downloadsSection = document.getElementById('downloadsSection');
const playlistBanner   = document.getElementById('playlistBanner');
const playlistText     = document.getElementById('playlistText');

// Settings modal
const btnSettings        = document.getElementById('btnSettings');
const settingsModal      = document.getElementById('settingsModal');
const btnCloseSettings   = document.getElementById('btnCloseSettings');
const settingAutoUpdate  = document.getElementById('settingAutoUpdate');
const btnCheckUpdate     = document.getElementById('btnCheckUpdate');
const btnInstallUpdate   = document.getElementById('btnInstallUpdate');
const settingCurrentVer  = document.getElementById('settingCurrentVer');
const settingLatestVer   = document.getElementById('settingLatestVer');
const latestVerCol       = document.getElementById('latestVerCol');
const verUpToDate        = document.getElementById('verUpToDate');
const updateLogWrap      = document.getElementById('updateLogWrap');
const updateLogArea      = document.getElementById('updateLogArea');
const updateProgressFill = document.getElementById('updateProgressFill');
const updateProgressTrack= document.getElementById('updateProgressTrack');
const updateDot          = document.getElementById('updateDot');

/* ── ffmpeg & yt-dlp version ────────────────────────── */
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
      if (settingCurrentVer) settingCurrentVer.textContent = d.version;
    }
  })
  .catch(() => {});

function updateEditorLabel() {
  const label = document.getElementById('editorAudioLabel');
  if (label) label.textContent = ffmpegAvailable ? t('editor_wav') : t('editor_m4a');
  const heroStatus = document.getElementById('heroFfmpegStatus');
  if (heroStatus) heroStatus.textContent = ffmpegAvailable ? t('hero_meta_ffmpeg') : t('hero_meta_ffmpeg_off');
}

/* ── Default dir ────────────────────────────────────── */
fetch('/api/default-dir')
  .then(r => r.json())
  .then(d => { if (outputDir) outputDir.value = d.dir; })
  .catch(() => {});

btnDefaultDir.addEventListener('click', () =>
  fetch('/api/default-dir').then(r => r.json()).then(d => { outputDir.value = d.dir; })
);

/* ── Settings modal ─────────────────────────────────── */
function openSettings() {
  settingsModal.hidden = false;
  // Refresh current version display
  fetch('/api/ytdlp-version')
    .then(r => r.json())
    .then(d => { if (d.version && settingCurrentVer) settingCurrentVer.textContent = d.version; })
    .catch(() => {});
}

function closeSettings() {
  settingsModal.hidden = true;
}

btnSettings.addEventListener('click', openSettings);
btnCloseSettings.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

// Load settings from server
fetch('/api/settings')
  .then(r => r.json())
  .then(s => { settingAutoUpdate.checked = !!s.autoUpdate; })
  .catch(() => {});

settingAutoUpdate.addEventListener('change', () => {
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoUpdate: settingAutoUpdate.checked })
  }).catch(() => {});
});

/* ── Check for updates (manual) ─────────────────────── */
btnCheckUpdate.addEventListener('click', async () => {
  const btnText = btnCheckUpdate.querySelector('.btn-text');
  const btnSpin = btnCheckUpdate.querySelector('.btn-spinner');
  btnCheckUpdate.disabled = true;
  if (btnText) btnText.textContent = t('update_checking');
  if (btnSpin) btnSpin.hidden = false;

  latestVerCol.hidden = true;
  verUpToDate.hidden = true;
  btnInstallUpdate.hidden = true;

  try {
    const res = await fetch('/api/check-updates');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Check failed');

    if (settingCurrentVer) settingCurrentVer.textContent = data.current || '—';

    if (data.updateAvailable) {
      settingLatestVer.textContent = data.latest;
      latestVerCol.hidden = false;
      btnInstallUpdate.hidden = false;
      updateDot.hidden = false;
    } else {
      verUpToDate.hidden = false;
      updateDot.hidden = true;
    }
  } catch (err) {
    showToast(err.message || t('toast_server_error'), 'error');
  } finally {
    btnCheckUpdate.disabled = false;
    if (btnText) btnText.textContent = t('btn_check_updates');
    if (btnSpin) btnSpin.hidden = true;
  }
});

/* ── Install update ─────────────────────────────────── */
btnInstallUpdate.addEventListener('click', () => {
  updateLogWrap.hidden = false;
  updateProgressTrack.hidden = false;
  updateProgressFill.style.width = '0%';
  updateLogArea.textContent = '';
  btnInstallUpdate.hidden = true;
  btnInstallUpdate.disabled = true;

  fetch('/api/update-ytdlp', { method: 'POST' }).catch(() => {});
});

/* ── Platform detection ─────────────────────────────── */
const PLATFORMS = [
  { key: 'youtube',    domains: ['youtube.com', 'youtu.be'] },
  { key: 'soundcloud', domains: ['soundcloud.com'] },
  { key: 'twitter',    domains: ['twitter.com', 'x.com'] },
  { key: 'instagram',  domains: ['instagram.com'] },
  { key: 'tiktok',     domains: ['tiktok.com', 'vm.tiktok.com'] },
  { key: 'vimeo',      domains: ['vimeo.com'] },
  { key: 'twitch',     domains: ['twitch.tv'] },
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
    urlInput.placeholder = `${item.dataset.name} — ${t('url_paste_here')}`;
    urlInput.value = '';
    infoCard.hidden = true;
  });
});

/* ── Sidebar format hints ───────────────────────────── */
document.querySelectorAll('.sb-format-hint').forEach(item => {
  item.addEventListener('click', () => {
    const type = item.dataset.type;
    if (!infoCard.hidden) {
      document.querySelectorAll('.fmt-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
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

/* ── Language switcher ──────────────────────────────── */
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

/* ── Analyze URL ────────────────────────────────────── */
async function analyzeUrl() {
  const url = urlInput.value.trim();
  if (!url) return showToast(t('toast_enter_url'), 'error');
  if (!url.startsWith('http')) return showToast(t('toast_invalid_url'), 'error');

  infoCard.hidden = true;
  selectedFormat = null;

  const btnText = btnAnalyze.querySelector('.btn-text');
  const btnSpin = btnAnalyze.querySelector('.btn-spinner');
  btnAnalyze.disabled = true;
  if (btnText) btnText.hidden = true;
  if (btnSpin) btnSpin.hidden = false;

  highlightPlatformSidebar(url);

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (!res.ok) return showToast(data.error || t('toast_server_error'), 'error');

    currentFormats = data.formats || [];

    videoTitle.textContent = data.title || '';
    videoUploader.textContent = data.uploader ? `📺 ${data.uploader}` : '';
    videoDuration.textContent = data.duration ? `⏱ ${fmtDur(data.duration)}` : '';

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

    const lastType = localStorage.getItem('mf_lastType') || 'audio';
    document.querySelectorAll('.fmt-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.type === lastType));
    currentType = lastType;
    renderFormats();

    infoCard.hidden = false;
    infoCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (playlistBanner && isPlaylistUrl(url)) {
      playlistBanner.hidden = false;
      if (playlistText) playlistText.textContent = t('playlist_detected');
      fetch('/api/playlist-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.ok ? r.json() : null).then(pl => {
        if (pl && playlistText) {
          playlistText.textContent = `${pl.title || t('playlist_label')} — ${pl.count || '?'}`;
        }
      }).catch(() => {});
    } else if (playlistBanner) {
      playlistBanner.hidden = true;
    }
  } catch {
    showToast(t('toast_no_server'), 'error');
  } finally {
    btnAnalyze.disabled = false;
    if (btnText) btnText.hidden = false;
    if (btnSpin) btnSpin.hidden = true;
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
  if (!selectedFormat) return showToast(t('toast_select_format'), 'error');
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
    if (!res.ok) return showToast(data.error || t('toast_dl_error'), 'error');

    addDownloadItem(data.downloadId, chkSeparateAudio.checked ? '🎬 Video' : null);
    if (data.audioDownloadId) addDownloadItem(data.audioDownloadId, '🎵 Audio');

    showToast(t('toast_dl_started'), 'success');
  } catch {
    showToast(t('toast_server_error'), 'error');
  }
});

/* ── Download items ─────────────────────────────────── */
const dlItems = new Map();
const dlDirs  = new Map();

function addDownloadItem(id, label) {
  downloadsSection.hidden = false;
  const item = document.createElement('div');
  item.className = 'dl-item';
  item.id = `dl-${id}`;

  const labelHtml = label ? `<span class="dl-label-tag">${label}</span>` : '';
  item.innerHTML = `
    <div class="dl-header-row">
      <span class="dl-filename">${labelHtml}${t('dl_starting')}</span>
      <span class="dl-status-pill running">${t('dl_running')}</span>
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
    <button class="dl-cancel-btn" data-id="${id}" title="${t('dl_cancel_title')}">✕</button>
  `;
  downloadList.prepend(item);
  dlItems.set(id, item);
  dlDirs.set(id, outputDir.value);

  item.querySelector('.dl-cancel-btn').addEventListener('click', () => {
    fetch(`/api/cancel/${id}`, { method: 'POST' });
  });
}

function makeDismissBtn(downloadId) {
  const btn = document.createElement('button');
  btn.className = 'dl-cancel-btn';
  btn.title = t('dl_dismiss_title');
  btn.textContent = '✕';
  btn.addEventListener('click', () => {
    const item = dlItems.get(downloadId);
    if (item) item.remove();
    dlItems.delete(downloadId);
    dlDirs.delete(downloadId);
  });
  return btn;
}

/* ── Notification ───────────────────────────────────── */
function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

/* ── History ────────────────────────────────────────── */
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
    histList.innerHTML = `<div class="hist-empty">${t('hist_empty')}</div>`;
    return;
  }
  histList.innerHTML = items.slice(0, 30).map(item => {
    const d = new Date(item.date);
    const dateStr = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    const label = item.title || item.filename || '';
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

  // yt-dlp version broadcast
  if (type === 'ytdlp-version') {
    const badge = document.getElementById('versionBadge');
    if (badge) badge.textContent = 'yt-dlp ' + msg.version;
    if (settingCurrentVer) settingCurrentVer.textContent = msg.version;
    return;
  }

  // Update system messages
  if (type === 'update-available') {
    updateDot.hidden = false;
    if (settingLatestVer) settingLatestVer.textContent = msg.latest;
    if (latestVerCol) latestVerCol.hidden = false;
    if (btnInstallUpdate) btnInstallUpdate.hidden = false;
    showToast(t('update_available_toast'), 'success');
    return;
  }
  if (type === 'update-log') {
    if (updateLogArea) {
      updateLogArea.textContent += msg.message;
      updateLogArea.scrollTop = updateLogArea.scrollHeight;
    }
    return;
  }
  if (type === 'update-progress') {
    if (updateProgressFill) updateProgressFill.style.width = (msg.percent || 0) + '%';
    return;
  }
  if (type === 'update-complete') {
    updateDot.hidden = true;
    if (latestVerCol) latestVerCol.hidden = true;
    if (verUpToDate) verUpToDate.hidden = false;
    if (btnInstallUpdate) { btnInstallUpdate.hidden = true; btnInstallUpdate.disabled = false; }
    if (!msg.alreadyLatest) showToast(t('update_complete_toast'), 'success');
    return;
  }
  if (type === 'update-error') {
    if (btnInstallUpdate) btnInstallUpdate.disabled = false;
    showToast(t('update_error_toast'), 'error');
    return;
  }

  if (!downloadId) return;

  const item = dlItems.get(downloadId);
  if (!item) return;

  switch (type) {
    case 'filename': {
      const lbl = item.querySelector('.dl-label-tag');
      const fn  = item.querySelector('.dl-filename');
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
      pill.textContent = t('dl_complete');
      const msgEl = item.querySelector('.dl-message');
      msgEl.textContent = t('dl_saved');
      msgEl.className = 'dl-message ok-msg';

      const openBtn = document.createElement('button');
      openBtn.className = 'dl-open-btn';
      openBtn.textContent = t('dl_open_folder');
      openBtn.addEventListener('click', () => {
        fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: dlDirs.get(downloadId) || outputDir.value || '' })
        }).catch(() => {});
      });
      msgEl.insertAdjacentElement('afterend', openBtn);

      const cancelBtn = item.querySelector('.dl-cancel-btn');
      if (cancelBtn) cancelBtn.replaceWith(makeDismissBtn(downloadId));

      const fnText = item.querySelector('.dl-filename')?.textContent || '';
      showNotification(t('notif_dl_complete'), fnText);
      showToast(t('notif_dl_complete'), 'success');
      loadHistory();
      break;
    }
    case 'error': {
      item.classList.add('error');
      const pill = item.querySelector('.dl-status-pill');
      pill.className = 'dl-status-pill error';
      pill.textContent = t('dl_error');
      const msgEl = item.querySelector('.dl-message');
      msgEl.textContent = msg.message || t('dl_error');
      msgEl.className = 'dl-message error-msg';
      const cancelBtn = item.querySelector('.dl-cancel-btn');
      if (cancelBtn) cancelBtn.replaceWith(makeDismissBtn(downloadId));
      showToast(t('toast_dl_failed'), 'error');
      break;
    }
    case 'cancelled': {
      item.classList.add('cancelled');
      const pill = item.querySelector('.dl-status-pill');
      pill.className = 'dl-status-pill cancelled';
      pill.textContent = t('dl_cancelled');
      const cancelBtn = item.querySelector('.dl-cancel-btn');
      if (cancelBtn) cancelBtn.replaceWith(makeDismissBtn(downloadId));
      break;
    }
  }
}

/* ── Helpers ────────────────────────────────────────── */
function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${m}:${String(ss).padStart(2,'0')}`;
}

let toastTimer;
function showToast(msg, type) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = `toast ${type || 'success'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3500);
}

/* ── Init ───────────────────────────────────────────── */
applyLang(currentLang);
loadHistory();
