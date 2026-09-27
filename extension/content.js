'use strict';
/* MediaFetch — IDM tarzı sayfa içi indirme butonu
   Video sayfalarına sabit konumlu buton + format seçici enjekte eder.
   Tıklanınca background.js üzerinden sunucuya istek gönderilir;
   indirme bittikten sonra dosya chrome.downloads ile bilgisayara çekilir. */

const BTN_ID    = 'mf-dl-btn';
const PANEL_ID  = 'mf-panel';
const STYLE_ID  = 'mf-styles';

let _dismissed = false;

const FORMATS = [
  { id: 'mp4-1080', label: '🎬 MP4  1080p' },
  { id: 'mp4-720',  label: '🎬 MP4  720p'  },
  { id: 'mp4-480',  label: '🎬 MP4  480p'  },
  { id: 'mp3-320',  label: '🎵 MP3  320 kbps' },
  { id: 'mp3-192',  label: '🎵 MP3  192 kbps' },
  { id: 'mp3-128',  label: '🎵 MP3  128 kbps' },
];

// ── Sayfa tespiti ──────────────────────────────────────────────────────────
function isVideoPage() {
  const { hostname: h, pathname: p, search: s } = location;
  if (h.includes('youtube.com'))  return s.includes('v=') || p.startsWith('/shorts/');
  if (h.includes('youtu.be'))     return true;
  if (h.includes('soundcloud.com')) return p.split('/').filter(Boolean).length >= 2;
  if (h.includes('twitter.com') || h.includes('x.com')) return p.includes('/status/');
  if (h.includes('tiktok.com'))   return p.includes('/video/');
  if (h.includes('instagram.com')) return /\/(p|reel|tv)\//.test(p);
  if (h.includes('vimeo.com'))    return /\/\d+/.test(p);
  return false;
}

function pageUrl() {
  // Shorts → watch URL
  if (location.hostname.includes('youtube.com') && location.pathname.startsWith('/shorts/')) {
    const id = location.pathname.split('/shorts/')[1].split(/[/?]/)[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return location.href;
}

function pageTitle() {
  return document.title
    .replace(/\s*[-|–—]\s*(YouTube|SoundCloud|Twitter|X|TikTok|Instagram|Vimeo).*$/i, '')
    .trim();
}

// ── CSS ────────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
#mf-dl-btn {
  position: fixed; bottom: 72px; right: 18px; z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  background: #7c3aed; color: #fff; border: none; border-radius: 50%;
  width: 44px; height: 44px;
  cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.4);
  transition: background .15s, transform .1s;
  user-select: none;
}
#mf-dl-btn:hover { background: #6d28d9; transform: scale(1.08); }

#mf-close-btn {
  position: fixed; bottom: 108px; right: 14px; z-index: 2147483648;
  display: flex; align-items: center; justify-content: center;
  background: #3f3f5a; color: #ccc; border: none; border-radius: 50%;
  width: 18px; height: 18px;
  cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.4);
  transition: background .1s;
  padding: 0;
}
#mf-close-btn:hover { background: #e53e3e; color: #fff; }

#mf-panel {
  position: fixed; bottom: 126px; right: 18px; z-index: 2147483647;
  background: #1a1a2e; border: 1px solid #3a3a5c; border-radius: 14px;
  padding: 10px 8px; min-width: 210px;
  box-shadow: 0 10px 30px rgba(0,0,0,.55);
  font-family: system-ui, sans-serif;
  animation: mf-pop .12s ease;
}
@keyframes mf-pop {
  from { opacity: 0; transform: translateY(6px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
#mf-panel .mf-head {
  font-size: 10px; text-transform: uppercase; letter-spacing: .1em;
  color: #666; padding: 2px 8px 8px;
}
#mf-panel .mf-opt {
  display: block; width: 100%; text-align: left;
  background: transparent; border: 1px solid transparent; border-radius: 8px;
  color: #dde; font-size: 13px; padding: 7px 10px; cursor: pointer;
  transition: background .1s, border-color .1s;
}
#mf-panel .mf-opt:hover:not(:disabled) { background: #2a2a48; border-color: #7c3aed66; }
#mf-panel .mf-opt:disabled { opacity: .45; cursor: not-allowed; }
#mf-panel .mf-sep {
  border: none; border-top: 1px solid #2e2e4a; margin: 6px 0;
}
#mf-panel .mf-status {
  font-size: 12px; color: #aab; padding: 6px 8px 2px; min-height: 22px;
}
`;
  (document.head || document.documentElement).appendChild(s);
}

// ── UI ─────────────────────────────────────────────────────────────────────
function removeUI() {
  document.getElementById(BTN_ID)?.remove();
  document.getElementById('mf-close-btn')?.remove();
  document.getElementById(PANEL_ID)?.remove();
}

function createUI() {
  if (document.getElementById(BTN_ID)) return;

  // Buton
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="12" y1="3" x2="12" y2="15"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="4" y1="20" x2="20" y2="20"/>
  </svg>`;
  btn.title = 'MediaFetch ile indir';

  // X — sayfayı yenileyene ya da URL değişene kadar gizle
  const closeBtn = document.createElement('button');
  closeBtn.id = 'mf-close-btn';
  closeBtn.title = 'Kapat';
  closeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="3" stroke-linecap="round">
    <line x1="4" y1="4" x2="20" y2="20"/>
    <line x1="20" y1="4" x2="4" y2="20"/>
  </svg>`;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById(BTN_ID)?.remove();
    document.getElementById('mf-close-btn')?.remove();
    document.getElementById(PANEL_ID)?.remove();
    // Mark dismissed for this URL — won't reappear until navigation
    _dismissed = true;
  });
  document.body.appendChild(closeBtn);

  // Format paneli
  const panel = document.createElement('div');
  panel.id  = PANEL_ID;
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'mf-head';
  head.textContent = 'Format seç';
  panel.appendChild(head);

  FORMATS.forEach((fmt, i) => {
    if (i === 3) { const hr = document.createElement('hr'); hr.className = 'mf-sep'; panel.appendChild(hr); }
    const opt = document.createElement('button');
    opt.className = 'mf-opt';
    opt.dataset.fmt = fmt.id;
    opt.textContent  = fmt.label;
    panel.appendChild(opt);
  });

  const status = document.createElement('div');
  status.className = 'mf-status';
  panel.appendChild(status);

  // Olaylar
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });

  document.addEventListener('click', () => { panel.hidden = true; }, { capture: true });

  panel.addEventListener('click', async (e) => {
    const opt = e.target.closest('.mf-opt');
    if (!opt || opt.disabled) return;
    e.stopPropagation();

    panel.querySelectorAll('.mf-opt').forEach(b => { b.disabled = true; });
    status.textContent = '⏳ Başlatılıyor…';

    const resp = await chrome.runtime.sendMessage({
      cmd: 'start',
      url: pageUrl(),
      formatId: opt.dataset.fmt,
      title: pageTitle(),
    }).catch(() => null);

    if (resp && resp.ok) {
      status.textContent = '✓ İndirme başladı — bildirim gelecek';
      setTimeout(() => {
        panel.hidden = true;
        panel.querySelectorAll('.mf-opt').forEach(b => { b.disabled = false; });
        status.textContent = '';
      }, 2000);
    } else {
      const msg = resp?.error === 'auth'
        ? '✗ Oturum açılmamış — eklenti ayarlarına git'
        : '✗ Sunucu hatası — eklentiyi kontrol et';
      status.textContent = msg;
      panel.querySelectorAll('.mf-opt').forEach(b => { b.disabled = false; });
    }
  });

  document.body.appendChild(btn);
  document.body.appendChild(panel);
}

// ── Kurulum + SPA desteği ──────────────────────────────────────────────────
function setup() {
  if (_dismissed) return;
  if (isVideoPage()) {
    injectStyles();
    // Sayfa hazır değilse kısa bekle (YouTube SPA geçişleri)
    if (document.body) {
      createUI();
    } else {
      document.addEventListener('DOMContentLoaded', createUI, { once: true });
    }
  } else {
    removeUI();
  }
}

setup();

// URL değişikliği izle (YouTube/TikTok SPA)
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href === _lastUrl) return;
  _lastUrl = location.href;
  _dismissed = false;
  removeUI();
  setTimeout(setup, 900);   // başlığın güncellenmesini bekle
}).observe(document.documentElement, { subtree: true, childList: true });
