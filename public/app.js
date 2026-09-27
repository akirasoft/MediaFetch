'use strict';
/* ═══════════════════════════════════════════════════════════════
   MediaFetch — frontend
   Talks to the local server (server.js) over REST + WebSocket.
   All text that comes from remote sites (titles, filenames, error
   messages) is inserted with textContent — never innerHTML.
   ═══════════════════════════════════════════════════════════════ */
(() => {

/* ── Storage (never throws) ─────────────────────────────────── */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k)    { try { localStorage.removeItem(k); } catch {} },
};

/* ── i18n ───────────────────────────────────────────────────── */
const LANGS = {
  tr: {
    nav_discover: 'Keşfet', nav_downloads: 'İndirmeler', nav_settings: 'Ayarlar',
    sb_platforms: 'Platformlar', sb_saveto: 'Kayıt klasörü', sb_change: 'Değiştir',
    status_connecting: 'Bağlanıyor…', status_online: 'Sunucu çalışıyor', status_offline: 'Sunucuya bağlanılamıyor',
    theme_dark: 'Koyu', theme_light: 'Açık', theme_system: 'Sistem',
    hero_badge: '1.000+ site destekleniyor', meta_ffmpeg_on: 'ffmpeg aktif', meta_ffmpeg_off: 'ffmpeg bulunamadı',
    hero_h1: 'Müzik & video,', hero_h2: 'tek bağlantıyla.',
    hero_sub: 'Bağlantıyı yapıştır, formatı seç, indir. Her şey bilgisayarında çalışır — hesap yok, bulut yok, iz bırakılmaz.',
    url_placeholder: 'https://www.youtube.com/watch?v=…', url_paste_here: '{name} bağlantısını yapıştır…',
    btn_clear_title: 'Temizle', btn_paste_title: 'Panodan yapıştır', btn_analyze: 'Analiz et',
    hint_paste: 'ile yapıştır ya da bir platform seç',
    st_detected: '{name} bağlantısı algılandı — analize hazır.', st_generic: 'Bağlantı hazır — yt-dlp 1.000+ siteyi destekler.',
    st_loading: 'Bilgiler alınıyor… bu birkaç saniye sürebilir.',
    err_empty: 'Önce bir bağlantı yapıştır.', err_invalid: 'Geçerli bir bağlantıya benzemiyor — http(s):// ile başlamalı.',
    err_info: 'Bu bağlantıdan bilgi alınamadı. Adresi kontrol et.', err_timeout: 'İstek zaman aşımına uğradı, tekrar dene.',
    err_no_ytdlp: 'yt-dlp kurulu değil — önce “node setup.js” çalıştır.', err_server: 'Sunucuya bağlanılamadı.',
    err_clipboard: 'Panoya erişilemedi — Ctrl+V ile yapıştır.',
    trust_local: 'Yerel çalışır', trust_noaccount: 'Hesap gerekmez', trust_opensource: 'Reklamsız & açık kaynak',
    res_new: 'Yeni bağlantı', set_defaults_link: 'Varsayılanları ayarla',
    res_playlist_detecting: 'Oynatma listesi algılandı…', res_playlist: '{title} — {n} parça · listenin tamamı indirilecek',
    playlist_label: 'Oynatma listesi',
    tab_audio: 'Ses', tab_video: 'Video',
    q_mp3_320: 'En yüksek MP3 kalitesi', q_mp3_192: 'Dengeli kalite ve boyut', q_mp3_128: 'Küçük boyut, konuşma için ideal',
    q_2160: 'Ultra HD', q_1440: 'QHD', q_1080: 'Full HD', q_720: 'HD', q_480: 'SD', q_360: 'En küçük boyut',
    q_default: 'Varsayılan',
    sep_label: 'Ses ve videoyu ayrı dosya olarak kaydet',
    sep_wav: 'MP4 + WAV — video editörleri için', sep_m4a: 'MP4 + M4A — ffmpeg bulunamadığı için WAV yok',
    out_label: 'Kaydedilecek', out_playlist: 'listedeki tüm dosyalar', btn_download: 'İndir',
    recent_title: 'Son indirilenler', see_all: 'Tümünü gör',
    toast_dl_started: 'İndirme başlatıldı', toast_view_downloads: 'İndirmeleri gör',
    toast_dl_done: 'İndirme tamamlandı', toast_open_folder: 'Klasörde göster',
    toast_dl_failed: 'İndirme başarısız', toast_dl_error: 'İndirme başlatılamadı',
    toast_update_available: 'yt-dlp güncellemesi mevcut', toast_open_settings: 'Ayarlar',
    toast_updated: 'yt-dlp güncellendi', toast_update_failed: 'Güncelleme başarısız',
    toast_history_cleared: 'Geçmiş temizlendi', toast_history_sub: 'Dosyaların klasörde durmaya devam ediyor.',
    dl_title: 'İndirmeler', dl_active: '{n} aktif', dl_session: 'Bu oturum',
    dl_open_folder: 'Klasörü aç', dl_clear_done: 'Bitenleri kaldır',
    dl_save_pc: 'Bilgisayarıma indir', set_folder_locked: 'Sunucu modunda sabit',
    set_keys: 'Erişim anahtarları',
    set_keys_hint: 'Her kişiye ayrı bir anahtar ver. Birini iptal etmek diğerlerini etkilemez.',
    set_keys_add: 'Oluştur', set_keys_name: 'Ad',
    set_ext_title: 'Tarayıcı eklentisi', set_ext_hint: 'YouTube, TikTok, Instagram gibi sayfalarda indirme butonu çıkarır. Kurulum: zip\'i indir → aç → Chrome/Brave\'de Geliştirici modu → Paketlenmemiş yükle.', set_ext_download: 'İndir (.zip)',
    key_copy_link: 'Giriş linkini kopyala', key_copy_key: 'Anahtarı kopyala',
    key_disable: 'İptal et', key_enable: 'Yeniden aç', key_delete: 'Sil',
    key_never: 'hiç kullanılmadı', key_downloads: '{n} indirme',
    key_disabled: 'iptal edildi', key_empty: 'Henüz anahtar yok.',
    key_added: 'Anahtar oluşturuldu', key_copied: 'Kopyalandı',
    key_name_required: 'Önce bir ad yaz', key_error: 'İşlem başarısız',
    key_delete_confirm: '{name} anahtarı silinsin mi? Bu kişi bir daha giremez.',
    set_autofetch: 'Bitince bilgisayarıma indir',
    set_autofetch_sub: 'Dosya sunucuda hazırlanır, biter bitmez tarayıcına iner',
    sb_saveto_remote: 'Nereye iner', sb_remote_path: 'Tarayıcının indirilenler klasörü',
    toast_sending_pc: 'Bilgisayarına aktarılıyor…',
    dl_empty: 'Bu oturumda henüz indirme yok.', dl_empty_cta: 'Bağlantı analiz et',
    dl_history: 'Geçmiş', dl_clear_history: 'Geçmişi temizle', hist_count: '{n} kayıt',
    hist_empty: 'Geçmiş boş — indirdiğin dosyalar burada listelenir.', hist_reanalyze: 'Yeniden analiz et',
    dl_starting: 'Başlatılıyor…', dl_processing: 'İşleniyor', dl_complete: 'Tamamlandı',
    dl_error: 'Hata', dl_cancelled: 'İptal edildi', dl_eta: 'kalan {eta}',
    dl_cancel: 'İndirmeyi iptal et', dl_dismiss: 'Listeden kaldır', dl_retry: 'Yeniden dene', dl_saved: 'Kaydedildi',
    tag_video: 'Video', tag_audio: 'Ses',
    msg_downloading: 'yt-dlp ile indiriliyor', msg_merging: 'FFmpeg · ses ve video birleştiriliyor',
    msg_extracting: 'FFmpeg · ses çıkarılıyor', msg_tiktok: 'TikTok analiz ediliyor', msg_validating: 'Doğrulanıyor',
    msg_finalizing: 'Son hazırlıklar yapılıyor', msg_playlist: 'Liste: {a} / {b}', msg_failed: 'İndirme başarısız oldu.', msg_cancelled: 'Durduruldu — yarım kalan .part dosyası klasörde kalmış olabilir.',
    date_today: 'bugün {time}', date_yesterday: 'dün {time}',
    set_title: 'Ayarlar', set_autosave: 'Değişiklikler otomatik kaydedilir',
    set_engine: 'Motor', set_engine_sub: 'İndirmeleri yapan araçlar ve güncellemeleri',
    btn_check: 'Güncellemeleri denetle', btn_install: '{v} sürümüne güncelle',
    ver_checking: 'Denetleniyor…', ver_available: '{v} mevcut', ver_uptodate: 'Güncel', ver_installing: 'Kuruluyor…', ver_error: 'Denetlenemedi',
    ffmpeg_sub: 'Ses çıkarma ve birleştirme için', ffmpeg_found: 'Bulundu', ffmpeg_missing: 'Bulunamadı',
    set_auto_update: 'Açılışta güncellemeleri otomatik denetle',
    set_auto_update_sub: 'Siteler değiştikçe yt-dlp’nin güncel kalması önemlidir',
    privacy_note: 'Güncellemeler doğrudan github.com/yt-dlp adresine bağlanır — aracı sunucu yok. Dosya değiştirilmeden önce SHA256 ile doğrulanır.',
    set_appearance: 'Görünüm & dil', set_theme: 'Tema', set_lang: 'Dil',
    set_defaults: 'İndirme varsayılanları', set_defaults_sub: 'Analiz ekranında önceden seçili gelir',
    set_audio_q: 'Ses kalitesi', set_video_q: 'Video kalitesi (yoksa bir alttaki seçilir)',
    set_folder: 'Kayıt klasörü', set_folder_default: 'Varsayılan', set_folder_open: 'Aç',
    set_folder_hint: 'Tam klasör yolunu yaz. Klasör yoksa ilk indirmede oluşturulur.',
    set_behavior: 'Davranış',
    set_notify: 'Masaüstü bildirimleri', set_notify_sub: 'Pencere arka plandayken indirme bitince bildir',
    notify_denied: 'Tarayıcı bildirim iznini engellemiş — adres çubuğundan izin verebilirsin.',
    set_autopaste: 'Yapıştırınca otomatik analiz et', set_autopaste_sub: 'Bağlantıyı yapıştırdığın anda bilgileri getir',
    set_separate: 'Ses ve videoyu ayrı kaydet', set_separate_sub: 'Video indirmelerinde bu seçenek işaretli gelir',
  },
  en: {
    nav_discover: 'Discover', nav_downloads: 'Downloads', nav_settings: 'Settings',
    sb_platforms: 'Platforms', sb_saveto: 'Save folder', sb_change: 'Change',
    status_connecting: 'Connecting…', status_online: 'Server running', status_offline: 'Cannot reach server',
    theme_dark: 'Dark', theme_light: 'Light', theme_system: 'System',
    hero_badge: '1,000+ sites supported', meta_ffmpeg_on: 'ffmpeg active', meta_ffmpeg_off: 'ffmpeg not found',
    hero_h1: 'Music & video,', hero_h2: 'from a single link.',
    hero_sub: 'Paste a link, pick a format, download. Everything runs on your computer — no account, no cloud, no tracking.',
    url_placeholder: 'https://www.youtube.com/watch?v=…', url_paste_here: 'Paste a {name} link…',
    btn_clear_title: 'Clear', btn_paste_title: 'Paste from clipboard', btn_analyze: 'Analyze',
    hint_paste: 'to paste, or pick a platform',
    st_detected: '{name} link detected — ready to analyze.', st_generic: 'Link ready — yt-dlp supports 1,000+ sites.',
    st_loading: 'Fetching info… this can take a few seconds.',
    err_empty: 'Paste a link first.', err_invalid: 'That doesn’t look like a valid link — it should start with http(s)://.',
    err_info: 'Couldn’t get info from this link. Check the address.', err_timeout: 'The request timed out, try again.',
    err_no_ytdlp: 'yt-dlp isn’t installed — run “node setup.js” first.', err_server: 'Cannot connect to the server.',
    err_clipboard: 'Clipboard not available — paste with Ctrl+V.',
    trust_local: 'Runs locally', trust_noaccount: 'No account needed', trust_opensource: 'Ad-free & open source',
    res_new: 'New link', set_defaults_link: 'Set defaults',
    res_playlist_detecting: 'Playlist detected…', res_playlist: '{title} — {n} items · the whole list will be downloaded',
    playlist_label: 'Playlist',
    tab_audio: 'Audio', tab_video: 'Video',
    q_mp3_320: 'Highest MP3 quality', q_mp3_192: 'Balanced quality and size', q_mp3_128: 'Small size, great for speech',
    q_2160: 'Ultra HD', q_1440: 'QHD', q_1080: 'Full HD', q_720: 'HD', q_480: 'SD', q_360: 'Smallest size',
    q_default: 'Default',
    sep_label: 'Save audio and video as separate files',
    sep_wav: 'MP4 + WAV — for video editors', sep_m4a: 'MP4 + M4A — no WAV because ffmpeg was not found',
    out_label: 'Will be saved as', out_playlist: 'every file in the list', btn_download: 'Download',
    recent_title: 'Recent downloads', see_all: 'See all',
    toast_dl_started: 'Download started', toast_view_downloads: 'View downloads',
    toast_dl_done: 'Download complete', toast_open_folder: 'Show in folder',
    toast_dl_failed: 'Download failed', toast_dl_error: 'Could not start download',
    toast_update_available: 'yt-dlp update available', toast_open_settings: 'Settings',
    toast_updated: 'yt-dlp updated', toast_update_failed: 'Update failed',
    toast_history_cleared: 'History cleared', toast_history_sub: 'Your files stay in the folder.',
    dl_title: 'Downloads', dl_active: '{n} active', dl_session: 'This session',
    dl_open_folder: 'Open folder', dl_clear_done: 'Clear finished',
    dl_save_pc: 'Save to my computer', set_folder_locked: 'Fixed in server mode',
    set_keys: 'Access keys',
    set_keys_hint: 'Give each person their own key. Revoking one leaves the rest working.',
    set_keys_add: 'Create', set_keys_name: 'Name',
    set_ext_title: 'Browser extension', set_ext_hint: 'Shows a download button on YouTube, TikTok, Instagram and more. Install: download zip → extract → Chrome/Brave Developer mode → Load unpacked.', set_ext_download: 'Download (.zip)',
    key_copy_link: 'Copy sign-in link', key_copy_key: 'Copy key',
    key_disable: 'Revoke', key_enable: 'Re-enable', key_delete: 'Delete',
    key_never: 'never used', key_downloads: '{n} downloads',
    key_disabled: 'revoked', key_empty: 'No keys yet.',
    key_added: 'Key created', key_copied: 'Copied',
    key_name_required: 'Enter a name first', key_error: 'That did not work',
    key_delete_confirm: 'Delete the key for {name}? They will not be able to sign in again.',
    set_autofetch: 'Save to my computer when done',
    set_autofetch_sub: 'The file is prepared on the server, then lands in your browser',
    sb_saveto_remote: 'Where it lands', sb_remote_path: 'Your browser downloads folder',
    toast_sending_pc: 'Transferring to your computer…',
    dl_empty: 'No downloads in this session yet.', dl_empty_cta: 'Analyze a link',
    dl_history: 'History', dl_clear_history: 'Clear history', hist_count: '{n} items',
    hist_empty: 'History is empty — files you download will be listed here.', hist_reanalyze: 'Analyze again',
    dl_starting: 'Starting…', dl_processing: 'Processing', dl_complete: 'Complete',
    dl_error: 'Error', dl_cancelled: 'Cancelled', dl_eta: '{eta} left',
    dl_cancel: 'Cancel download', dl_dismiss: 'Remove from list', dl_retry: 'Try again', dl_saved: 'Saved',
    tag_video: 'Video', tag_audio: 'Audio',
    msg_downloading: 'Downloading with yt-dlp', msg_merging: 'FFmpeg · merging audio and video',
    msg_extracting: 'FFmpeg · extracting audio', msg_tiktok: 'Analyzing TikTok', msg_validating: 'Validating',
    msg_finalizing: 'Finalizing', msg_playlist: 'List: {a} / {b}', msg_failed: 'The download failed.', msg_cancelled: 'Stopped — a partial .part file may remain in the folder.',
    date_today: 'today {time}', date_yesterday: 'yesterday {time}',
    set_title: 'Settings', set_autosave: 'Changes are saved automatically',
    set_engine: 'Engine', set_engine_sub: 'The tools that do the downloading, and their updates',
    btn_check: 'Check for updates', btn_install: 'Update to {v}',
    ver_checking: 'Checking…', ver_available: '{v} available', ver_uptodate: 'Up to date', ver_installing: 'Installing…', ver_error: 'Check failed',
    ffmpeg_sub: 'Used for extracting and merging audio', ffmpeg_found: 'Found', ffmpeg_missing: 'Not found',
    set_auto_update: 'Automatically check for updates on startup',
    set_auto_update_sub: 'Sites change often — keeping yt-dlp current matters',
    privacy_note: 'Updates connect directly to github.com/yt-dlp — no intermediary server. The binary is verified with SHA256 before replacing.',
    set_appearance: 'Appearance & language', set_theme: 'Theme', set_lang: 'Language',
    set_defaults: 'Download defaults', set_defaults_sub: 'Pre-selected on the analyze screen',
    set_audio_q: 'Audio quality', set_video_q: 'Video quality (falls back to the next lower one)',
    set_folder: 'Save folder', set_folder_default: 'Default', set_folder_open: 'Open',
    set_folder_hint: 'Type the full folder path. It is created on the first download if missing.',
    set_behavior: 'Behaviour',
    set_notify: 'Desktop notifications', set_notify_sub: 'Notify when a download finishes while the window is in the background',
    notify_denied: 'The browser blocked notifications — allow them from the address bar.',
    set_autopaste: 'Analyze on paste', set_autopaste_sub: 'Fetch info as soon as you paste a link',
    set_separate: 'Save audio and video separately', set_separate_sub: 'Pre-ticks this option for video downloads',
  },
  es: {
    nav_discover: 'Explorar', nav_downloads: 'Descargas', nav_settings: 'Ajustes',
    sb_platforms: 'Plataformas', sb_saveto: 'Carpeta de destino', sb_change: 'Cambiar',
    status_connecting: 'Conectando…', status_online: 'Servidor activo', status_offline: 'Sin conexión con el servidor',
    theme_dark: 'Oscuro', theme_light: 'Claro', theme_system: 'Sistema',
    hero_badge: '1.000+ sitios compatibles', meta_ffmpeg_on: 'ffmpeg activo', meta_ffmpeg_off: 'ffmpeg no encontrado',
    hero_h1: 'Música y vídeo,', hero_h2: 'con un solo enlace.',
    hero_sub: 'Pega un enlace, elige el formato y descarga. Todo se ejecuta en tu ordenador — sin cuenta, sin nube, sin rastreo.',
    url_placeholder: 'https://www.youtube.com/watch?v=…', url_paste_here: 'Pega un enlace de {name}…',
    btn_clear_title: 'Borrar', btn_paste_title: 'Pegar del portapapeles', btn_analyze: 'Analizar',
    hint_paste: 'para pegar, o elige una plataforma',
    st_detected: 'Enlace de {name} detectado — listo para analizar.', st_generic: 'Enlace listo — yt-dlp admite 1.000+ sitios.',
    st_loading: 'Obteniendo información… puede tardar unos segundos.',
    err_empty: 'Primero pega un enlace.', err_invalid: 'No parece un enlace válido — debe empezar por http(s)://.',
    err_info: 'No se pudo obtener información de este enlace. Revisa la dirección.', err_timeout: 'La solicitud caducó, inténtalo de nuevo.',
    err_no_ytdlp: 'yt-dlp no está instalado — ejecuta primero “node setup.js”.', err_server: 'No se puede conectar al servidor.',
    err_clipboard: 'No hay acceso al portapapeles — pega con Ctrl+V.',
    trust_local: 'Funciona en local', trust_noaccount: 'Sin cuenta', trust_opensource: 'Sin anuncios y de código abierto',
    res_new: 'Nuevo enlace', set_defaults_link: 'Ajustar predeterminados',
    res_playlist_detecting: 'Lista detectada…', res_playlist: '{title} — {n} elementos · se descargará la lista completa',
    playlist_label: 'Lista de reproducción',
    tab_audio: 'Audio', tab_video: 'Vídeo',
    q_mp3_320: 'Máxima calidad MP3', q_mp3_192: 'Calidad y tamaño equilibrados', q_mp3_128: 'Tamaño pequeño, ideal para voz',
    q_2160: 'Ultra HD', q_1440: 'QHD', q_1080: 'Full HD', q_720: 'HD', q_480: 'SD', q_360: 'Tamaño mínimo',
    q_default: 'Predeterminado',
    sep_label: 'Guardar audio y vídeo en archivos separados',
    sep_wav: 'MP4 + WAV — para editores de vídeo', sep_m4a: 'MP4 + M4A — sin WAV porque no se encontró ffmpeg',
    out_label: 'Se guardará como', out_playlist: 'todos los archivos de la lista', btn_download: 'Descargar',
    recent_title: 'Descargas recientes', see_all: 'Ver todo',
    toast_dl_started: 'Descarga iniciada', toast_view_downloads: 'Ver descargas',
    toast_dl_done: 'Descarga completada', toast_open_folder: 'Mostrar en carpeta',
    toast_dl_failed: 'Descarga fallida', toast_dl_error: 'No se pudo iniciar la descarga',
    toast_update_available: 'Actualización de yt-dlp disponible', toast_open_settings: 'Ajustes',
    toast_updated: 'yt-dlp actualizado', toast_update_failed: 'Error al actualizar',
    toast_history_cleared: 'Historial borrado', toast_history_sub: 'Tus archivos siguen en la carpeta.',
    dl_title: 'Descargas', dl_active: '{n} activas', dl_session: 'Esta sesión',
    dl_open_folder: 'Abrir carpeta', dl_clear_done: 'Quitar terminadas',
    dl_save_pc: 'Guardar en mi ordenador', set_folder_locked: 'Fijada en modo servidor',
    set_keys: 'Claves de acceso',
    set_keys_hint: 'Da a cada persona su propia clave. Revocar una no afecta a las demás.',
    set_keys_add: 'Crear', set_keys_name: 'Nombre',
    set_ext_title: 'Extensión del navegador', set_ext_hint: 'Muestra un botón de descarga en YouTube, TikTok, Instagram y más. Instalación: descarga el zip → extrae → Modo desarrollador en Chrome/Brave → Cargar descomprimida.', set_ext_download: 'Descargar (.zip)',
    key_copy_link: 'Copiar enlace de acceso', key_copy_key: 'Copiar clave',
    key_disable: 'Revocar', key_enable: 'Reactivar', key_delete: 'Eliminar',
    key_never: 'nunca usada', key_downloads: '{n} descargas',
    key_disabled: 'revocada', key_empty: 'Aún no hay claves.',
    key_added: 'Clave creada', key_copied: 'Copiado',
    key_name_required: 'Escribe un nombre primero', key_error: 'No se pudo completar',
    key_delete_confirm: '¿Eliminar la clave de {name}? No podrá volver a entrar.',
    set_autofetch: 'Guardar en mi ordenador al terminar',
    set_autofetch_sub: 'El archivo se prepara en el servidor y luego llega a tu navegador',
    sb_saveto_remote: 'Dónde llega', sb_remote_path: 'Carpeta de descargas del navegador',
    toast_sending_pc: 'Transfiriendo a tu ordenador…',
    dl_empty: 'Aún no hay descargas en esta sesión.', dl_empty_cta: 'Analizar un enlace',
    dl_history: 'Historial', dl_clear_history: 'Borrar historial', hist_count: '{n} elementos',
    hist_empty: 'El historial está vacío — aquí aparecerán tus descargas.', hist_reanalyze: 'Analizar de nuevo',
    dl_starting: 'Iniciando…', dl_processing: 'Procesando', dl_complete: 'Completada',
    dl_error: 'Error', dl_cancelled: 'Cancelada', dl_eta: 'quedan {eta}',
    dl_cancel: 'Cancelar descarga', dl_dismiss: 'Quitar de la lista', dl_retry: 'Reintentar', dl_saved: 'Guardado',
    tag_video: 'Vídeo', tag_audio: 'Audio',
    msg_downloading: 'Descargando con yt-dlp', msg_merging: 'FFmpeg · uniendo audio y vídeo',
    msg_extracting: 'FFmpeg · extrayendo audio', msg_tiktok: 'Analizando TikTok', msg_validating: 'Validando',
    msg_finalizing: 'Finalizando', msg_playlist: 'Lista: {a} / {b}', msg_failed: 'La descarga falló.', msg_cancelled: 'Detenida — puede quedar un archivo .part parcial en la carpeta.',
    date_today: 'hoy {time}', date_yesterday: 'ayer {time}',
    set_title: 'Ajustes', set_autosave: 'Los cambios se guardan automáticamente',
    set_engine: 'Motor', set_engine_sub: 'Las herramientas que descargan y sus actualizaciones',
    btn_check: 'Buscar actualizaciones', btn_install: 'Actualizar a {v}',
    ver_checking: 'Comprobando…', ver_available: '{v} disponible', ver_uptodate: 'Actualizado', ver_installing: 'Instalando…', ver_error: 'Error al comprobar',
    ffmpeg_sub: 'Para extraer y unir audio', ffmpeg_found: 'Encontrado', ffmpeg_missing: 'No encontrado',
    set_auto_update: 'Comprobar actualizaciones al iniciar',
    set_auto_update_sub: 'Los sitios cambian a menudo — conviene mantener yt-dlp al día',
    privacy_note: 'Las actualizaciones se conectan directamente a github.com/yt-dlp — sin servidor intermediario. El binario se verifica con SHA256 antes de reemplazarlo.',
    set_appearance: 'Apariencia e idioma', set_theme: 'Tema', set_lang: 'Idioma',
    set_defaults: 'Opciones de descarga', set_defaults_sub: 'Preseleccionadas en la pantalla de análisis',
    set_audio_q: 'Calidad de audio', set_video_q: 'Calidad de vídeo (si no existe, la inmediatamente inferior)',
    set_folder: 'Carpeta de destino', set_folder_default: 'Predeterminada', set_folder_open: 'Abrir',
    set_folder_hint: 'Escribe la ruta completa. Si no existe, se crea en la primera descarga.',
    set_behavior: 'Comportamiento',
    set_notify: 'Notificaciones de escritorio', set_notify_sub: 'Avisar al terminar una descarga si la ventana está en segundo plano',
    notify_denied: 'El navegador bloqueó las notificaciones — puedes permitirlas desde la barra de direcciones.',
    set_autopaste: 'Analizar al pegar', set_autopaste_sub: 'Obtener la información en cuanto pegas un enlace',
    set_separate: 'Guardar audio y vídeo por separado', set_separate_sub: 'Marca esta opción por defecto en los vídeos',
  },
};

let lang = store.get('mf_lang', 'tr');
if (!LANGS[lang]) lang = 'tr';
const LOCALE = { tr: 'tr-TR', en: 'en-GB', es: 'es-ES' };

function t(key, vars) {
  let s = (LANGS[lang] && LANGS[lang][key]) ?? LANGS.tr[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/* ── DOM helpers ────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const SVG_NS = 'http://www.w3.org/2000/svg';

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.entries(v).forEach(([p, val]) => el.style.setProperty(p, val));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return el;
}

function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.appendChild(use);
  return svg;
}

const WAVE_BARS = [[0, 8, 6], [5, 4, 14], [10, 1, 20], [15, 6, 10], [20, 3, 16], [25, 7, 8], [30, 2, 18], [35, 5, 12], [40, 8, 6]];
function wave() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'wave');
  svg.setAttribute('viewBox', '0 0 46 22');
  svg.setAttribute('aria-hidden', 'true');
  WAVE_BARS.forEach(([x, y, hgt]) => {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 2.5); r.setAttribute('height', hgt); r.setAttribute('rx', 1);
    svg.appendChild(r);
  });
  return svg;
}

async function api(path, opts = {}) {
  const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
  if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  const res = await fetch(path, init);
  let data = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}
const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });

/* ── Platforms (original lettermarks in platform colours) ───── */
const PLATFORMS = [
  { key: 'youtube',    name: 'YouTube',     mono: 'YT', bg: '#FF0033', fg: '#FFFFFF', domains: ['youtube.com', 'youtu.be'] },
  { key: 'soundcloud', name: 'SoundCloud',  mono: 'SC', bg: '#FF5500', fg: '#2A1400', domains: ['soundcloud.com'] },
  { key: 'twitter',    name: 'Twitter / X', mono: 'X',  bg: '#101418', fg: '#FFFFFF', domains: ['twitter.com', 'x.com'] },
  { key: 'instagram',  name: 'Instagram',   mono: 'IG', bg: '#C1275A', fg: '#FFFFFF', domains: ['instagram.com'] },
  { key: 'tiktok',     name: 'TikTok',      mono: 'TT', bg: '#101418', fg: '#25F4EE', domains: ['tiktok.com'] },
  { key: 'vimeo',      name: 'Vimeo',       mono: 'VM', bg: '#1AB7EA', fg: '#04222C', domains: ['vimeo.com'] },
  { key: 'twitch',     name: 'Twitch',      mono: 'TW', bg: '#9146FF', fg: '#FFFFFF', domains: ['twitch.tv'] },
];
const platformByKey = (k) => PLATFORMS.find((p) => p.key === k) || null;

function parseUrl(s) {
  try {
    const u = new URL(String(s).trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u : null;
  } catch { return null; }
}
function detectPlatform(url) {
  const u = parseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  return PLATFORMS.find((p) => p.domains.some((d) => host === d || host.endsWith('.' + d))) || null;
}
function hostOf(url) { const u = parseUrl(url); return u ? u.hostname.replace(/^www\./, '') : ''; }
const isPlaylistUrl = (url) => url.includes('list=') || url.includes('/playlist') || url.includes('/sets/');

function pbadge(p, size) {
  const el = h('span', { class: 'pbadge' + (size ? ' ' + size : ''), 'aria-hidden': 'true' }, p ? p.mono : 'WEB');
  el.style.setProperty('--p-bg', p ? p.bg : 'var(--line-2)');
  el.style.setProperty('--p-fg', p ? p.fg : 'var(--text-2)');
  if (!p) el.style.fontSize = size === 'xs' ? '6px' : '7px';
  return el;
}

/* ── Formats ────────────────────────────────────────────────── */
const FMT = {
  'mp3-320': { title: '320 kbps', sub: 'q_mp3_320' },
  'mp3-192': { title: '192 kbps', sub: 'q_mp3_192' },
  'mp3-128': { title: '128 kbps', sub: 'q_mp3_128' },
  'mp4-2160': { title: '2160p · 4K', sub: 'q_2160' },
  'mp4-1440': { title: '1440p · 2K', sub: 'q_1440' },
  'mp4-1080': { title: '1080p', sub: 'q_1080' },
  'mp4-720': { title: '720p', sub: 'q_720' },
  'mp4-480': { title: '480p', sub: 'q_480' },
  'mp4-360': { title: '360p', sub: 'q_360' },
};
function fmtShort(id) {
  const [kind, q] = String(id).split('-');
  return kind === 'mp3' ? `MP3 · ${q} kbps` : `MP4 · ${q === '2160' ? '4K' : q + 'p'}`;
}

/* ── Preferences ────────────────────────────────────────────── */
const prefs = {
  get theme()     { return store.get('mf_theme', 'dark'); },
  get notify()    { return store.get('mf_notify', '1') === '1'; },
  get autoPaste() { return store.get('mf_autoPaste', '1') === '1'; },
  // Hosted mode only: pull the finished file down as soon as it is ready.
  get autoFetch() { return store.get('mf_autoFetch', '1') === '1'; },
  get separate()  { return store.get('mf_separate', '0') === '1'; },
  get defAudio()  { return store.get('mf_defAudio', (store.get('mf_lastFormat', '') || '').startsWith('mp3') ? store.get('mf_lastFormat') : 'mp3-320'); },
  get defVideo()  { return store.get('mf_defVideo', (store.get('mf_lastFormat', '') || '').startsWith('mp4') ? store.get('mf_lastFormat') : 'mp4-1080'); },
};

/* ── State ──────────────────────────────────────────────────── */
const S = {
  view: 'home',
  pickedPlatform: null,
  analyzing: false,
  reqSeq: 0,
  info: null,            // { url, title, uploader, duration, thumbnail, formats, platform }
  playlist: null,        // { state: 'loading'|'ok', title, count }
  type: store.get('mf_lastType', 'audio') === 'video' ? 'video' : 'audio',
  selected: null,
  status: { kind: 'hint' },
  ffmpeg: null, ffmpegPath: '',
  version: '', latest: '',
  upd: 'idle', updPct: 0,
  autoUpdate: false,
  outputDir: store.get('mf_outputDir', ''),
  defaultDir: '',
  // What the server is willing to do. A hosted instance cannot open a folder
  // on the user's machine, so finished files are offered as HTTP downloads.
  cfg: { serverMode: false, canOpenFolder: true, allowCustomDir: true, isOwner: false },
  keys: [],               // per-person access keys (owner only)
  history: [],
  dls: new Map(),
  pending: new Map(),    // WS messages that arrived before the download item existed
  ws: 'connecting',
};

/* ── Elements ───────────────────────────────────────────────── */
const el = {
  html: document.documentElement,
  home: document.querySelector('.home'),
  urlField: $('urlField'), urlInput: $('urlInput'), urlLead: $('urlLead'),
  urlChip: $('urlChip'), urlChipBadge: $('urlChipBadge'), urlChipName: $('urlChipName'),
  btnClear: $('btnClear'), btnPaste: $('btnPaste'), btnAnalyze: $('btnAnalyze'),
  urlStatus: $('urlStatus'),
  platformList: $('platformList'), platformChips: $('platformChips'),
  result: $('result'), btnNewLink: $('btnNewLink'),
  playlistBanner: $('playlistBanner'), playlistText: $('playlistText'),
  thumbImg: $('thumbImg'), thumbBadge: $('thumbBadge'), mediaDur: $('mediaDur'),
  resTitle: $('resTitle'), mediaUploaderWrap: $('mediaUploaderWrap'), mediaUploader: $('mediaUploader'),
  mediaDurWrap: $('mediaDurWrap'), mediaDurText: $('mediaDurText'),
  formatGrid: $('formatGrid'), sepOption: $('sepOption'), chkSeparate: $('chkSeparate'), sepSub: $('sepSub'),
  outFile: $('outFile'), btnDownload: $('btnDownload'),
  recent: $('recent'), recentGrid: $('recentGrid'),
  navDlCount: $('navDlCount'), navUpdateDot: $('navUpdateDot'), topUpdateDot: $('topUpdateDot'),
  sbVersion: $('sbVersion'), sbFolderPath: $('sbFolderPath'),
  serverPill: $('serverPill'), serverText: $('serverText'), topVersion: $('topVersion'),
  heroFfmpeg: $('heroFfmpeg'),
  dlList: $('dlList'), dlEmpty: $('dlEmpty'), dlActivePill: $('dlActivePill'),
  btnOpenFolder: $('btnOpenFolder'), btnClearDone: $('btnClearDone'),
  histList: $('histList'), histEmpty: $('histEmpty'), histCount: $('histCount'), btnClearHistory: $('btnClearHistory'),
  setYtVer: $('setYtVer'), verChip: $('verChip'),
  btnCheckUpdate: $('btnCheckUpdate'), btnCheckUpdateText: $('btnCheckUpdateText'),
  btnInstallUpdate: $('btnInstallUpdate'), btnInstallText: $('btnInstallText'),
  updProgress: $('updProgress'), updProgressFill: $('updProgressFill'), updLog: $('updLog'),
  ffmpegTag: $('ffmpegTag'),
  swAutoUpdate: $('swAutoUpdate'), swNotify: $('swNotify'), swAutoPaste: $('swAutoPaste'), swSeparate: $('swSeparate'),
  swAutoFetch: $('swAutoFetch'), rowAutoFetch: $('rowAutoFetch'),
  cardKeys: $('cardKeys'), keyName: $('keyName'), btnAddKey: $('btnAddKey'), keyList: $('keyList'),
  folderCardLabel: document.querySelector('#folderCard [data-i18n="sb_saveto"]'),
  notifySub: $('notifySub'),
  segAudioQ: $('segAudioQ'), segVideoQ: $('segVideoQ'),
  outputDir: $('outputDir'), btnDefaultDir: $('btnDefaultDir'), btnOpenDir: $('btnOpenDir'),
  toasts: $('toasts'),
};

/* ═══════════════════════════════════════════════════════════════
   Language & theme
   ═══════════════════════════════════════════════════════════════ */
function applyLang(next) {
  if (next && LANGS[next]) { lang = next; store.set('mf_lang', lang); }
  el.html.lang = lang;
  $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  $$('[data-i18n-title]').forEach((n) => { n.title = t(n.dataset.i18nTitle); });
  $$('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  $$('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  el.swAutoUpdate.setAttribute('aria-label', t('set_auto_update'));
  el.swNotify.setAttribute('aria-label', t('set_notify'));
  el.swAutoPaste.setAttribute('aria-label', t('set_autopaste'));
  el.swSeparate.setAttribute('aria-label', t('set_separate'));
  if (S.pickedPlatform && !el.urlInput.value) el.urlInput.placeholder = t('url_paste_here', { name: platformByKey(S.pickedPlatform).name });
  renderAll();
}

const darkMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function effectiveTheme() {
  const p = prefs.theme;
  if (p === 'system') return darkMQ && darkMQ.matches ? 'dark' : 'light';
  return p === 'light' ? 'light' : 'dark';
}
function applyTheme(pref) {
  if (pref) store.set('mf_theme', pref);
  const eff = effectiveTheme();
  el.html.dataset.theme = eff;
  $$('[data-theme-set]').forEach((b) => {
    const inTopbar = !!b.closest('.topbar');
    b.classList.toggle('active', inTopbar ? b.dataset.themeSet === eff : b.dataset.themeSet === prefs.theme);
    b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
  });
}
if (darkMQ) darkMQ.addEventListener('change', () => { if (prefs.theme === 'system') applyTheme(); });

/* ═══════════════════════════════════════════════════════════════
   Router
   ═══════════════════════════════════════════════════════════════ */
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const view = hash === 'downloads' || hash === 'settings' ? hash : 'home';
  S.view = view;
  $$('[data-view-panel]').forEach((p) => { p.hidden = p.dataset.viewPanel !== view; });
  $$('[data-view]').forEach((a) => {
    const on = a.dataset.view === view;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelector('.views').scrollTop = 0;
  $$(`.toast[data-go="${view}"]`).forEach((n) => n.remove());
  if (view === 'downloads') loadHistory();
  if (view === 'home' && !S.info) setTimeout(() => el.urlInput.focus({ preventScroll: true }), 0);
}
window.addEventListener('hashchange', route);

/* ═══════════════════════════════════════════════════════════════
   Home: platforms, URL field, status line
   ═══════════════════════════════════════════════════════════════ */
function buildPlatforms() {
  el.platformList.replaceChildren(...PLATFORMS.map((p) =>
    h('button', { class: 'platform-item', 'data-platform': p.key, onclick: () => pickPlatform(p.key) }, pbadge(p), p.name)));
  el.platformChips.replaceChildren(...PLATFORMS.map((p) =>
    h('button', { class: 'chip', 'data-platform': p.key, onclick: () => pickPlatform(p.key) }, pbadge(p, 'sm'), p.name)));
}

function pickPlatform(key) {
  S.pickedPlatform = key;
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  resetResult();
  el.urlInput.value = '';
  el.urlInput.placeholder = t('url_paste_here', { name: platformByKey(key).name });
  S.status = { kind: 'hint' };
  renderUrlField();
  el.urlInput.focus();
}

function renderUrlField() {
  const raw = el.urlInput.value.trim();
  const u = parseUrl(raw);
  const p = u ? detectPlatform(raw) : null;
  const activeKey = p ? p.key : (!raw ? S.pickedPlatform : null);

  el.btnClear.hidden = !el.urlInput.value;
  el.urlChip.hidden = !u;
  el.urlLead.hidden = !!u;
  if (u) {
    el.urlChipBadge.replaceWith(el.urlChipBadge = Object.assign(pbadge(p), { id: 'urlChipBadge' }));
    el.urlChipName.textContent = p ? p.name : hostOf(raw);
  }
  $$('[data-platform]').forEach((b) => b.classList.toggle('active', b.dataset.platform === activeKey));

  // Passive status (don't overwrite loading / error messages)
  if (S.status.kind === 'hint' || S.status.kind === 'ok') {
    S.status = u ? { kind: 'ok', text: p ? t('st_detected', { name: p.name }) : t('st_generic') } : { kind: 'hint' };
  }
  renderStatus();
}

function renderStatus() {
  const s = S.status;
  el.urlField.classList.toggle('error', s.kind === 'err');
  let node;
  if (s.kind === 'err') node = h('span', { class: 'st st-err', role: 'alert' }, icon('alert'), s.text);
  else if (s.kind === 'ok') node = h('span', { class: 'st st-ok' }, icon('check'), s.text);
  else if (s.kind === 'load') node = h('span', { class: 'st st-load' }, icon('spinner', 'spin'), s.text);
  else node = h('span', { class: 'st st-hint' }, h('kbd', null, 'Ctrl'), h('kbd', null, 'V'), ' ' + t('hint_paste'));
  el.urlStatus.replaceChildren(node);
}

function setError(text) { S.status = { kind: 'err', text }; renderStatus(); }

el.urlInput.addEventListener('input', () => {
  if (S.status.kind === 'err') S.status = { kind: 'hint' };
  renderUrlField();
});
el.urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); analyze(); } });
el.urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    S.status = { kind: 'hint' };
    renderUrlField();
    if (prefs.autoPaste && parseUrl(el.urlInput.value)) analyze();
  }, 0);
});
// Ctrl+V anywhere on the home view pastes into the URL field.
document.addEventListener('paste', (e) => {
  if (S.view !== 'home') return;
  const tgt = e.target;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
  const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (!text.trim()) return;
  e.preventDefault();
  el.urlInput.value = text.trim();
  S.status = { kind: 'hint' };
  renderUrlField();
  el.urlInput.focus();
  if (prefs.autoPaste && parseUrl(text)) analyze();
});

el.btnClear.addEventListener('click', () => {
  el.urlInput.value = '';
  S.status = { kind: 'hint' };
  resetResult();
  renderUrlField();
  el.urlInput.focus();
});

el.btnPaste.addEventListener('click', async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) { el.urlInput.focus(); return; }
    el.urlInput.value = text;
    S.status = { kind: 'hint' };
    renderUrlField();
    analyze();
  } catch {
    el.urlInput.focus();
    setError(t('err_clipboard'));
  }
});

el.btnAnalyze.addEventListener('click', analyze);
el.btnNewLink.addEventListener('click', () => {
  el.urlInput.value = '';
  S.status = { kind: 'hint' };
  resetResult();
  renderUrlField();
  el.urlInput.focus();
});

/* ── Analyze ────────────────────────────────────────────────── */
function mapServerError(msg, status) {
  const m = String(msg || '');
  if (/url required/i.test(m)) return t('err_empty');
  if (/invalid url|only http/i.test(m)) return t('err_invalid');
  if (status === 408 || /timed out|timeout/i.test(m)) return t('err_timeout');
  if (/not installed/i.test(m)) return t('err_no_ytdlp');
  if (/could not fetch video info|parse video info|could not run/i.test(m)) return t('err_info');
  return m || t('err_info');
}

function setAnalyzeLoading(on) {
  el.btnAnalyze.disabled = on;
  el.btnAnalyze.classList.toggle('loading', on);
  el.btnAnalyze.querySelector('.spin').hidden = !on;
}

async function analyze() {
  const raw = el.urlInput.value.trim();
  if (!raw) { setError(t('err_empty')); el.urlInput.focus(); return; }
  if (!parseUrl(raw)) { setError(t('err_invalid')); el.urlInput.focus(); return; }
  if (S.analyzing && S.info && S.info.url === raw) return;

  const req = ++S.reqSeq;
  S.analyzing = true;
  setAnalyzeLoading(true);
  S.status = { kind: 'load', text: t('st_loading') };
  renderStatus();

  try {
    const { ok, status, data } = await post('/api/info', { url: raw });
    if (req !== S.reqSeq) return;
    if (!ok) { resetResult(); setError(mapServerError(data.error, status)); return; }

    S.info = {
      url: raw,
      title: data.title || hostOf(raw),
      uploader: data.uploader || '',
      duration: data.duration || 0,
      thumbnail: data.thumbnail || '',
      formats: Array.isArray(data.formats) ? data.formats : [],
      platform: detectPlatform(raw),
    };
    S.selected = null;
    if (!S.info.formats.some((f) => f.type === S.type)) S.type = S.type === 'audio' ? 'video' : 'audio';
    el.chkSeparate.checked = prefs.separate;
    S.playlist = isPlaylistUrl(raw) ? { state: 'loading' } : null;
    S.status = { kind: 'hint' };
    renderUrlField();
    renderResult();

    if (S.playlist) {
      post('/api/playlist-info', { url: raw }).then(({ ok: pok, data: pl }) => {
        if (req !== S.reqSeq || !S.playlist) return;
        S.playlist = pok ? { state: 'ok', title: pl.title || t('playlist_label'), count: pl.count || '?' } : { state: 'ok', title: t('playlist_label'), count: '?' };
        renderPlaylist();
        renderOut();
      }).catch(() => {});
    }
  } catch {
    if (req === S.reqSeq) { resetResult(); setError(t('err_server')); }
  } finally {
    if (req === S.reqSeq) { S.analyzing = false; setAnalyzeLoading(false); }
  }
}

function resetResult() {
  S.reqSeq++;
  S.analyzing = false;
  setAnalyzeLoading(false);
  S.info = null;
  S.playlist = null;
  S.selected = null;
  el.result.hidden = true;
  el.home.classList.remove('has-result');
  el.thumbImg.removeAttribute('src');
  renderRecent();
}

/* ── Result panel ───────────────────────────────────────────── */
function fmtDur(s) {
  s = Math.max(0, Math.floor(s));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}

function renderResult() {
  const info = S.info;
  if (!info) return;
  el.home.classList.add('has-result');
  el.result.hidden = false;

  el.resTitle.textContent = info.title;
  el.mediaUploader.textContent = info.uploader;
  el.mediaUploaderWrap.hidden = !info.uploader;
  el.mediaDurText.textContent = info.duration ? fmtDur(info.duration) : '';
  el.mediaDurWrap.hidden = !info.duration;
  el.mediaDur.textContent = info.duration ? fmtDur(info.duration) : '';
  el.mediaDur.hidden = !info.duration;

  const nb = pbadge(info.platform);
  nb.classList.add('media-thumb-badge');
  nb.id = 'thumbBadge';
  el.thumbBadge.replaceWith(nb);
  el.thumbBadge = nb;

  el.thumbImg.hidden = true;
  if (info.thumbnail) {
    const proxy = info.platform && (info.platform.key === 'tiktok' || info.platform.key === 'instagram');
    el.thumbImg.onload = () => { el.thumbImg.hidden = false; };
    el.thumbImg.onerror = () => { el.thumbImg.hidden = true; };
    el.thumbImg.src = proxy ? `/api/thumb?url=${encodeURIComponent(info.thumbnail)}` : info.thumbnail;
  } else {
    el.thumbImg.removeAttribute('src');
  }

  renderPlaylist();
  renderTabs();
  renderFormats();
  renderOut();
  el.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPlaylist() {
  if (!S.playlist) { el.playlistBanner.hidden = true; return; }
  el.playlistBanner.hidden = false;
  if (S.playlist.state === 'loading') el.playlistText.textContent = t('res_playlist_detecting');
  else el.playlistText.textContent = t('res_playlist', { title: S.playlist.title, n: S.playlist.count });
}

function renderTabs() {
  $$('.tab').forEach((b) => {
    const on = b.dataset.type === S.type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.hidden = !!S.info && !S.info.formats.some((f) => f.type === b.dataset.type);
  });
}
$$('.tab').forEach((b) => b.addEventListener('click', () => {
  S.type = b.dataset.type;
  store.set('mf_lastType', S.type);
  S.selected = null;
  renderTabs();
  renderFormats();
  renderOut();
}));

function defaultFor(type) { return type === 'audio' ? prefs.defAudio : prefs.defVideo; }

function pickDefault(list, def) {
  if (!list.length) return null;
  if (list.some((f) => f.id === def)) return def;
  const want = parseInt(String(def).split('-')[1], 10) || 0;
  const q = (f) => parseInt(String(f.id).split('-')[1], 10) || 0;
  const lower = list.filter((f) => q(f) <= want).sort((a, b) => q(b) - q(a));
  return (lower[0] || list[list.length - 1]).id;
}

function renderFormats() {
  if (!S.info) return;
  const list = S.info.formats.filter((f) => f.type === S.type);
  const def = defaultFor(S.type);
  if (!S.selected || !list.some((f) => f.id === S.selected)) S.selected = pickDefault(list, def);

  el.formatGrid.replaceChildren(...list.map((f) => {
    const meta = FMT[f.id];
    const sel = f.id === S.selected;
    return h('button', {
      class: 'fmt' + (sel ? ' selected' : ''), role: 'radio', 'aria-checked': sel ? 'true' : 'false',
      onclick: () => { S.selected = f.id; renderFormats(); renderOut(); },
    },
      h('span', { class: 'fmt-top' },
        h('span', { class: 'fmt-badge' }, f.type === 'audio' ? 'MP3' : 'MP4'),
        f.id === def && !sel ? h('span', { class: 'fmt-default' }, t('q_default')) : null,
        h('span', { class: 'fmt-check' }, icon('check'))),
      h('span', { class: 'fmt-title' }, meta ? meta.title : (f.label || f.id)),
      h('span', { class: 'fmt-sub' }, meta ? t(meta.sub) : ''));
  }));

  el.sepOption.hidden = S.type !== 'video';
  el.sepSub.textContent = S.ffmpeg === false ? t('sep_m4a') : t('sep_wav');
  el.btnDownload.disabled = !S.selected;
}

el.chkSeparate.addEventListener('change', renderOut);

function currentDir() { return S.outputDir || S.defaultDir || ''; }
function safeName(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'media'; }

function renderOut() {
  if (!S.info) return;
  const dir = currentDir();
  const sepCh = dir.includes('\\') ? '\\' : '/';
  const dirText = dir ? dir.replace(/[\\/]+$/, '') + sepCh : '';
  const name = safeName(S.info.title);
  const kids = [h('span', { class: 'dir' }, dirText)];

  if (S.playlist) {
    kids.push(t('out_playlist'));
  } else if (S.type === 'audio') {
    kids.push(name, h('span', { class: 'ext' }, '.mp3'));
  } else if (el.chkSeparate.checked) {
    kids.push(name + ' [Video]', h('span', { class: 'ext' }, '.mp4'), '  +  [Audio]', h('span', { class: 'ext' }, S.ffmpeg === false ? '.m4a' : '.wav'));
  } else {
    kids.push(name, h('span', { class: 'ext' }, '.mp4'));
  }
  el.outFile.replaceChildren(...kids);
  el.outFile.title = el.outFile.textContent;
}

/* ── Download ───────────────────────────────────────────────── */
el.btnDownload.addEventListener('click', async () => {
  if (!S.info || !S.selected) return;
  // Ask for notification permission while we still have the click gesture.
  if (prefs.notify && 'Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission().then(renderPrefs); } catch {}
  }
  const info = S.info;
  const formatId = S.selected;
  const separate = S.type === 'video' && el.chkSeparate.checked;
  el.btnDownload.disabled = true;
  try {
    const { ok, data } = await post('/api/download', {
      url: info.url, formatId, outputDir: S.outputDir || null, separateAudio: separate,
    });
    if (!ok) { toast({ kind: 'error', title: t('toast_dl_error'), sub: data.error || '' }); return; }
    const base = { title: info.title, platform: info.platform ? info.platform.key : null, url: info.url, dir: currentDir() };
    addDl(data.downloadId, { ...base, kind: formatId.startsWith('mp3') ? 'audio' : 'video', fmt: fmtShort(formatId), tag: separate ? 'video' : null });
    if (data.audioDownloadId) {
      addDl(data.audioDownloadId, { ...base, kind: 'audio', fmt: S.ffmpeg === false ? 'M4A' : 'WAV', tag: 'audio' });
    }
    toast({ kind: 'ok', icon: 'download', title: t('toast_dl_started'), sub: info.title, go: 'downloads', action: { label: t('toast_view_downloads'), fn: () => { location.hash = '#/downloads'; } } });
  } catch {
    toast({ kind: 'error', title: t('toast_dl_error'), sub: t('err_server') });
  } finally {
    el.btnDownload.disabled = !S.selected;
  }
});

/* ═══════════════════════════════════════════════════════════════
   Downloads
   ═══════════════════════════════════════════════════════════════ */
const ACTIVE = new Set(['starting', 'running', 'processing']);

function addDl(id, base) {
  if (!id) return;
  const d = { id, ...base, status: 'starting', percent: 0, speed: '', eta: '', size: '', msg: null, filename: '', node: null, shownStatus: null };
  S.dls.set(id, d);
  renderDl(d);
  renderDlSummary();
  const queued = S.pending.get(id);
  if (queued) { S.pending.delete(id); queued.forEach(applyDlMsg); }
}

function statusMessage(raw) {
  const m = String(raw || '');
  let mm;
  if (/merging/i.test(m)) return { key: 'msg_merging', processing: true };
  if (/extracting audio/i.test(m)) return { key: 'msg_extracting', processing: true };
  if ((mm = m.match(/playlist:\s*(\d+)\s*\/\s*(\d+)/i))) return { key: 'msg_playlist', vars: { a: mm[1], b: mm[2] } };
  if (/analyzing tiktok/i.test(m)) return { key: 'msg_tiktok' };
  if (/validating/i.test(m)) return { key: 'msg_validating' };
  if (/finalizing/i.test(m)) return { key: 'msg_finalizing' };
  if (/downloading/i.test(m)) return { key: 'msg_downloading' };
  return m ? { raw: m } : null;
}
const msgText = (msg) => (msg ? (msg.key ? t(msg.key, msg.vars) : msg.raw) : '');

function applyDlMsg(msg) {
  const d = S.dls.get(msg.downloadId);
  if (!d) return;
  switch (msg.type) {
    case 'start':
      if (d.status === 'starting') d.status = 'running';
      break;
    case 'filename':
      d.filename = msg.filename || d.filename;
      break;
    case 'progress':
      if (!ACTIVE.has(d.status)) break;
      d.status = 'running';
      d.percent = Math.max(0, Math.min(100, Number(msg.percent) || 0));
      if (msg.speed) d.speed = msg.speed;
      if (msg.eta) d.eta = msg.eta;
      if (msg.size) d.size = msg.size;
      break;
    case 'status': {
      if (!ACTIVE.has(d.status)) break;
      const sm = statusMessage(msg.message);
      d.msg = sm;
      if (sm && sm.processing) d.status = 'processing';
      else if (d.status === 'starting') d.status = 'running';
      break;
    }
    case 'complete':
      d.status = 'complete'; d.percent = 100;
      if (msg.filename) d.filename = msg.filename;
      d.fileUrl = msg.fileUrl || '';
      d.fileSize = msg.size || 0;
      onDlComplete(d);
      break;
    case 'error':
      d.status = 'error'; d.error = msg.message || '';
      if (S.view !== 'downloads') toast({ kind: 'error', title: t('toast_dl_failed'), sub: d.filename || d.title, go: 'downloads', action: { label: t('toast_view_downloads'), fn: () => { location.hash = '#/downloads'; } } });
      break;
    case 'cancelled':
      d.status = 'cancelled';
      break;
    default: return;
  }
  renderDl(d);
  renderDlSummary();
}

function onDlComplete(d) {
  const name = d.filename || d.title;
  // On the Downloads page the list already shows this — no toast on top of it.
  // On a hosted instance the file is still on the server — the download is only
  // really finished once it has reached this machine, so fetch it right away.
  const transfer = canFetchFile(d) && prefs.autoFetch;
  if (transfer) saveToComputer(d);

  const action = canFetchFile(d)
    ? { label: t('dl_save_pc'), fn: () => saveToComputer(d) }
    : { label: t('toast_open_folder'), fn: () => openFolder(d.dir) };
  if (S.view !== 'downloads') {
    toast({ kind: 'ok', title: t('toast_dl_done'), sub: transfer ? t('toast_sending_pc') : name, action });
  }
  if (prefs.notify && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
    try { new Notification(t('toast_dl_done'), { body: name, tag: 'mf-' + d.id }); } catch {}
  }
  loadHistory();
}

function openFolder(dir) { post('/api/open-folder', { dir: dir || currentDir() }).catch(() => {}); }

// True when the file lives on a server the user is not sitting at: the only way
// to get it is to pull it down over HTTP.
function canFetchFile(d) { return !!(d && d.fileUrl) && S.cfg.canOpenFolder === false; }

async function saveToComputer(d) {
  if (!d || !d.fileUrl) return;
  toast({ kind: 'info', title: t('toast_sending_pc') });
  try {
    // Fetch the file into memory first so the browser triggers a blob-URL
    // download, which bypasses the "ask where to save" dialog entirely.
    const res = await fetch(d.fileUrl);
    if (!res.ok) throw new Error('fetch ' + res.status);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download  = d.filename || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    // Blob fetch failed — fall back to a direct link (may show dialog).
    const a = document.createElement('a');
    a.href = d.fileUrl;
    a.download = d.filename || '';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function dlStateLabel(d) {
  switch (d.status) {
    case 'running': return d.percent ? `${d.percent < 10 ? d.percent.toFixed(1) : Math.round(d.percent)}%` : '';
    case 'processing': return t('dl_processing');
    case 'complete': return t('dl_complete');
    case 'error': return t('dl_error');
    case 'cancelled': return t('dl_cancelled');
    default: return '';
  }
}

function dlMetaText(d) {
  switch (d.status) {
    case 'starting': return t('dl_starting');
    case 'running': {
      const parts = [];
      const m = msgText(d.msg);
      if (d.msg && d.msg.key === 'msg_playlist') parts.push(m);
      if (d.size) parts.push(d.size);
      if (d.speed) parts.push(d.speed);
      if (d.eta) parts.push(t('dl_eta', { eta: d.eta }));
      if (!parts.length) parts.push(m || t('msg_downloading'));
      return parts.join(' · ');
    }
    case 'processing': return msgText(d.msg) || t('dl_processing');
    case 'complete': return `${t('dl_saved')} · ${d.dir || ''}`;
    case 'error': return d.error || t('msg_failed');
    case 'cancelled': return t('msg_cancelled');
    default: return '';
  }
}

function dlActions(d) {
  const btns = [];
  if (ACTIVE.has(d.status)) {
    btns.push(h('button', { class: 'icon-btn', 'aria-label': t('dl_cancel'), title: t('dl_cancel'),
      onclick: () => post(`/api/cancel/${encodeURIComponent(d.id)}`).catch(() => {}) }, icon('x')));
  } else {
    if (d.status === 'complete') {
      if (canFetchFile(d)) {
        btns.push(h('button', { class: 'icon-btn', 'aria-label': t('dl_save_pc'), title: t('dl_save_pc'),
          onclick: () => saveToComputer(d) }, icon('download')));
      } else if (S.cfg.canOpenFolder !== false) {
        btns.push(h('button', { class: 'icon-btn', 'aria-label': t('toast_open_folder'), title: t('toast_open_folder'),
          onclick: () => openFolder(d.dir) }, icon('folder')));
      }
    }
    if (d.status === 'error' || d.status === 'cancelled') {
      btns.push(h('button', { class: 'icon-btn', 'aria-label': t('dl_retry'), title: t('dl_retry'), onclick: () => reanalyze(d.url) }, icon('refresh')));
    }
    btns.push(h('button', { class: 'icon-btn', 'aria-label': t('dl_dismiss'), title: t('dl_dismiss'),
      onclick: () => { d.node && d.node.remove(); S.dls.delete(d.id); renderDlSummary(); } }, icon('x')));
  }
  return btns;
}

function renderDl(d) {
  if (!d.node) {
    const p = platformByKey(d.platform);
    const thumb = h('span', { class: 'fthumb ' + (d.kind === 'audio' ? 'a' : 'v') },
      d.kind === 'audio' ? wave() : icon('play', 'fill'), pbadge(p));
    d.refs = {
      tag: d.tag ? h('span', { class: 'dl-tag' }, '') : null,
      name: h('span', { class: 'dl-name' }),
      fmt: h('span', { class: 'dl-tag' }, d.fmt || ''),
      state: h('span', { class: 'dl-state' }),
      fill: h('div', { class: 'progress-fill' }),
      meta: h('div', { class: 'dl-meta' }),
      actions: h('div', { class: 'dl-actions' }),
    };
    const r = d.refs;
    d.node = h('div', { class: 'dl', 'data-id': d.id }, thumb,
      h('div', { class: 'dl-body' },
        h('div', { class: 'dl-row' }, r.tag, r.name, r.fmt, r.state),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, r.fill),
        r.meta),
      r.actions);
    el.dlList.prepend(d.node);
  }
  const r = d.refs;
  d.node.className = 'dl ' + d.status + (d.status === 'processing' ? ' indeterminate' : '');
  if (r.tag) r.tag.textContent = d.tag === 'audio' ? t('tag_audio') : t('tag_video');
  r.name.textContent = d.filename || d.title || t('dl_starting');
  r.name.title = r.name.textContent;
  r.state.textContent = dlStateLabel(d);
  r.fill.style.width = (d.status === 'complete' ? 100 : d.percent) + '%';
  r.fill.parentElement.setAttribute('aria-valuenow', String(Math.round(d.percent)));
  r.meta.textContent = dlMetaText(d);
  if (d.shownStatus !== d.status || d.shownLang !== lang) {
    r.actions.replaceChildren(...dlActions(d));
    d.shownStatus = d.status;
    d.shownLang = lang;
  }
}

function renderDlSummary() {
  const all = [...S.dls.values()];
  const active = all.filter((d) => ACTIVE.has(d.status)).length;
  const finished = all.length - active;
  el.navDlCount.hidden = active === 0;
  el.navDlCount.textContent = String(active);
  el.dlActivePill.hidden = active === 0;
  el.dlActivePill.textContent = t('dl_active', { n: active });
  el.dlEmpty.hidden = all.length > 0;
  el.btnClearDone.hidden = finished === 0;
  document.title = active ? `(${active}) MediaFetch` : 'MediaFetch';
}

el.btnClearDone.addEventListener('click', () => {
  for (const d of [...S.dls.values()]) {
    if (!ACTIVE.has(d.status)) { d.node && d.node.remove(); S.dls.delete(d.id); }
  }
  renderDlSummary();
});
el.btnOpenFolder.addEventListener('click', () => openFolder(currentDir()));

/* ── History ────────────────────────────────────────────────── */
const AUDIO_EXT = /\.(mp3|m4a|wav|opus|aac|flac|ogg|oga)$/i;
const stripExt = (s) => String(s || '').replace(/\.[a-z0-9]{2,4}$/i, '');

function relDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const time = d.toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return t('date_today', { time });
  if (diff === 1) return t('date_yesterday', { time });
  return d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

async function loadHistory() {
  try {
    const { ok, data } = await api('/api/history');
    if (!ok || !Array.isArray(data)) return;
    S.history = data.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    renderHistory();
    renderRecent();
  } catch {}
}

function histEntry(item) {
  const file = item.filename || item.title || '';
  return {
    url: item.url || '',
    title: stripExt(item.title || item.filename || item.url || ''),
    isAudio: AUDIO_EXT.test(file),
    platform: detectPlatform(item.url || ''),
    date: item.date,
  };
}

function reanalyze(url) {
  if (!url) return;
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  el.urlInput.value = url;
  S.status = { kind: 'hint' };
  renderUrlField();
  analyze();
}

function renderHistory() {
  const items = S.history.slice(0, 60).map(histEntry);
  el.histList.replaceChildren(...items.map((it) =>
    h('button', { class: 'hist', title: it.title, onclick: () => reanalyze(it.url), disabled: !it.url },
      icon(it.isAudio ? 'music' : 'video'),
      it.platform ? pbadge(it.platform, 'xs') : null,
      h('span', { class: 'hist-title' }, it.title),
      h('span', { class: 'hist-date' }, relDate(it.date)),
      h('span', { class: 'hist-go', title: t('hist_reanalyze') }, icon('arrow-right')))));
  el.histEmpty.hidden = items.length > 0;
  el.btnClearHistory.hidden = items.length === 0;
  el.histCount.textContent = items.length ? t('hist_count', { n: S.history.length }) : '';
}

function renderRecent() {
  const items = S.history.slice(0, 3).map(histEntry);
  el.recent.hidden = items.length === 0;
  el.recentGrid.replaceChildren(...items.map((it) =>
    h('button', { class: 'rcard', title: it.title, onclick: () => reanalyze(it.url), disabled: !it.url },
      h('span', { class: 'fthumb ' + (it.isAudio ? 'a' : 'v') }, it.isAudio ? wave() : icon('play', 'fill'), it.platform ? pbadge(it.platform) : null),
      h('span', { class: 'rcard-body' },
        h('span', { class: 'rcard-title' }, it.title),
        h('span', { class: 'rcard-meta' }, it.isAudio ? t('tab_audio') : t('tab_video'), ' · ', relDate(it.date))))));
}

el.btnClearHistory.addEventListener('click', async () => {
  try {
    await post('/api/history/clear');
    S.history = [];
    renderHistory();
    renderRecent();
    toast({ kind: 'info', icon: 'trash', title: t('toast_history_cleared'), sub: t('toast_history_sub') });
  } catch {}
});

/* ═══════════════════════════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════════════════════════ */
function renderVersion() {
  const v = S.version;
  el.sbVersion.textContent = location.host;
  el.topVersion.textContent = v ? `· yt-dlp ${v}` : '';
  el.setYtVer.textContent = v || '—';
}

function renderFfmpeg() {
  const known = S.ffmpeg !== null;
  el.ffmpegTag.className = 'tag' + (known ? (S.ffmpeg ? ' ok' : ' bad') : '');
  el.ffmpegTag.textContent = known ? t(S.ffmpeg ? 'ffmpeg_found' : 'ffmpeg_missing') : '—';
  el.ffmpegTag.title = S.ffmpegPath || '';
  el.heroFfmpeg.textContent = t(S.ffmpeg === false ? 'meta_ffmpeg_off' : 'meta_ffmpeg_on');
  el.heroFfmpeg.closest('.hero-badge').classList.toggle('warn', S.ffmpeg === false);
  el.sepSub.textContent = S.ffmpeg === false ? t('sep_m4a') : t('sep_wav');
}

function renderUpdate() {
  const u = S.upd;
  const chip = {
    checking: ['', t('ver_checking')],
    available: ['warn', t('ver_available', { v: S.latest })],
    installing: ['warn', t('ver_installing')],
    uptodate: ['ok', t('ver_uptodate')],
    error: ['bad', t('ver_error')],
  }[u];
  el.verChip.hidden = !chip;
  if (chip) { el.verChip.className = 'tag' + (chip[0] ? ' ' + chip[0] : ''); el.verChip.textContent = chip[1]; }

  const busy = u === 'checking' || u === 'installing';
  el.btnCheckUpdate.hidden = u === 'available' || u === 'installing';
  el.btnCheckUpdate.disabled = busy;
  el.btnCheckUpdate.querySelector('.spin').hidden = u !== 'checking';
  el.btnCheckUpdateText.textContent = u === 'checking' ? t('ver_checking') : t('btn_check');
  el.btnInstallUpdate.hidden = u !== 'available';
  el.btnInstallText.textContent = t('btn_install', { v: S.latest });
  el.updProgress.hidden = u !== 'installing';
  el.updProgressFill.style.width = (S.updPct || 0) + '%';
  el.navUpdateDot.hidden = el.topUpdateDot.hidden = u !== 'available';
}

function setSwitch(btn, on) { btn.setAttribute('aria-checked', on ? 'true' : 'false'); }

function renderPrefs() {
  setSwitch(el.swAutoUpdate, S.autoUpdate);
  const denied = 'Notification' in window && Notification.permission === 'denied';
  setSwitch(el.swNotify, prefs.notify && !denied);
  el.notifySub.textContent = denied ? t('notify_denied') : t('set_notify_sub');
  setSwitch(el.swAutoPaste, prefs.autoPaste);
  setSwitch(el.swSeparate, prefs.separate);
  setSwitch(el.swAutoFetch, prefs.autoFetch);
  // The switch only means anything when the server is somewhere else.
  el.rowAutoFetch.hidden = S.cfg.canOpenFolder !== false;
  $$('.seg-btn', el.segAudioQ).forEach((b) => b.classList.toggle('active', b.dataset.q === prefs.defAudio));
  $$('.seg-btn', el.segVideoQ).forEach((b) => b.classList.toggle('active', b.dataset.q === prefs.defVideo));
  if (document.activeElement !== el.outputDir) el.outputDir.value = currentDir();
  el.outputDir.placeholder = S.defaultDir;
  renderSbFolder();
}

/* ══════════════════════════════════════════════════════════════
   Access keys — owner only
   ══════════════════════════════════════════════════════════════ */

// The address a guest should use. The configured public address wins: a free
// Cloudflare quick tunnel gets a new hostname on every restart, so a link built
// from it would stop working the next time the server comes back up.
function shareBase() {
  return (S.cfg.publicUrl || S.cfg.tunnelUrl || location.origin).replace(/\/+$/, '');
}

const loginLink = (key) => `${shareBase()}/login?t=${encodeURIComponent(key)}`;

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ kind: 'ok', title: okMsg || t('key_copied') });
  } catch {
    // Clipboard is blocked (insecure origin, denied permission) — show the
    // value so it can still be copied by hand instead of failing silently.
    window.prompt(okMsg || t('key_copied'), text);
  }
}

function keyMeta(k) {
  const parts = [];
  if (k.disabled) parts.push(t('key_disabled'));
  parts.push(t('key_downloads', { n: k.downloads || 0 }));
  parts.push(k.lastUsed ? new Date(k.lastUsed).toLocaleString() : t('key_never'));
  return parts.join(' · ');
}

function renderKeys() {
  el.cardKeys.hidden = !S.cfg.isOwner;
  if (!S.cfg.isOwner) return;

  if (!S.keys.length) {
    el.keyList.replaceChildren(h('p', { class: 'key-empty', text: t('key_empty') }));
    return;
  }

  el.keyList.replaceChildren(...S.keys.map((k) => h('div', { class: 'key-row' + (k.disabled ? ' off' : '') },
    h('span', { class: 'key-main' },
      h('span', { class: 'key-name', text: k.name }),
      h('span', { class: 'key-meta', text: keyMeta(k) }),
      h('span', { class: 'key-value mono', text: k.key })),
    h('span', { class: 'key-actions' },
      h('button', {
        class: 'icon-btn', title: t('key_copy_link'), 'aria-label': t('key_copy_link'),
        onclick: () => copyText(loginLink(k.key)),
      }, icon('link')),
      h('button', {
        class: 'icon-btn', title: t('key_copy_key'), 'aria-label': t('key_copy_key'),
        onclick: () => copyText(k.key),
      }, icon('paste')),
      h('button', {
        class: 'icon-btn',
        title: k.disabled ? t('key_enable') : t('key_disable'),
        'aria-label': k.disabled ? t('key_enable') : t('key_disable'),
        onclick: () => toggleKey(k),
      }, icon(k.disabled ? 'check' : 'user-x')),
      h('button', {
        class: 'icon-btn', title: t('key_delete'), 'aria-label': t('key_delete'),
        onclick: () => deleteKey(k),
      }, icon('trash'))))));
}

async function loadKeys() {
  if (!S.cfg.isOwner) return;
  const { ok, data } = await api('/api/keys').catch(() => ({ ok: false, data: {} }));
  if (!ok) return;
  S.keys = data.keys || [];
  renderKeys();
}

async function addKey() {
  const name = el.keyName.value.trim();
  if (!name) { toast({ kind: 'warn', title: t('key_name_required') }); el.keyName.focus(); return; }

  el.btnAddKey.disabled = true;
  const { ok, data } = await post('/api/keys', { name }).catch(() => ({ ok: false, data: {} }));
  el.btnAddKey.disabled = false;

  if (!ok) { toast({ kind: 'error', title: t('key_error'), sub: data.error || '' }); return; }
  el.keyName.value = '';
  S.keys.push(data.key);
  renderKeys();
  toast({
    kind: 'ok', title: t('key_added'), sub: data.key.name,
    action: { label: t('key_copy_link'), fn: () => copyText(loginLink(data.key.key)) },
  });
}

async function toggleKey(k) {
  const { ok, data } = await post(`/api/keys/${encodeURIComponent(k.id)}/toggle`)
    .catch(() => ({ ok: false, data: {} }));
  if (!ok) { toast({ kind: 'error', title: t('key_error'), sub: data.error || '' }); return; }
  Object.assign(k, data.key);
  renderKeys();
}

async function deleteKey(k) {
  if (!window.confirm(t('key_delete_confirm', { name: k.name }))) return;
  const { ok, data } = await post(`/api/keys/${encodeURIComponent(k.id)}/delete`)
    .catch(() => ({ ok: false, data: {} }));
  if (!ok) { toast({ kind: 'error', title: t('key_error'), sub: data.error || '' }); return; }
  S.keys = S.keys.filter(x => x.id !== k.id);
  renderKeys();
}

el.btnAddKey.addEventListener('click', addKey);
el.keyName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKey(); });

// Let long paths wrap at separators instead of mid-word.
function renderSbFolder() {
  // Hosted mode: showing the server's folder here reads as "your files stay on
  // the server", which is the opposite of what happens. Name the real destination.
  if (S.cfg.canOpenFolder === false) {
    if (el.folderCardLabel) el.folderCardLabel.textContent = t('sb_saveto_remote');
    el.sbFolderPath.textContent = t('sb_remote_path');
    el.sbFolderPath.title = t('sb_remote_path');
    return;
  }
  if (el.folderCardLabel) el.folderCardLabel.textContent = t('sb_saveto');
  const d = currentDir();
  el.sbFolderPath.textContent = d ? d.replace(/([\\/])/g, '$1​') : '—';
  el.sbFolderPath.title = d;
}

el.btnCheckUpdate.addEventListener('click', async () => {
  S.upd = 'checking';
  renderUpdate();
  try {
    const { ok, data } = await api('/api/check-updates');
    if (!ok) throw new Error(data.error || '');
    if (data.current) { S.version = data.current; renderVersion(); }
    if (data.updateAvailable) { S.latest = data.latest; S.upd = 'available'; }
    else S.upd = 'uptodate';
  } catch (err) {
    S.upd = 'error';
    toast({ kind: 'error', title: t('toast_update_failed'), sub: (err && err.message) || t('err_server') });
  }
  renderUpdate();
});

el.btnInstallUpdate.addEventListener('click', () => {
  S.upd = 'installing';
  S.updPct = 0;
  el.updLog.textContent = '';
  el.updLog.hidden = false;
  renderUpdate();
  post('/api/update-ytdlp').catch(() => { S.upd = 'error'; renderUpdate(); });
});

el.swAutoUpdate.addEventListener('click', () => {
  S.autoUpdate = !S.autoUpdate;
  renderPrefs();
  post('/api/settings', { autoUpdate: S.autoUpdate }).catch(() => {});
});
el.swNotify.addEventListener('click', async () => {
  const next = !prefs.notify || (('Notification' in window) && Notification.permission === 'denied');
  store.set('mf_notify', next ? '1' : '0');
  if (next && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  renderPrefs();
});
el.swAutoPaste.addEventListener('click', () => { store.set('mf_autoPaste', prefs.autoPaste ? '0' : '1'); renderPrefs(); });
el.swSeparate.addEventListener('click', () => { store.set('mf_separate', prefs.separate ? '0' : '1'); renderPrefs(); });
el.swAutoFetch.addEventListener('click', () => { store.set('mf_autoFetch', prefs.autoFetch ? '0' : '1'); renderPrefs(); });

el.segAudioQ.addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  store.set('mf_defAudio', b.dataset.q); renderPrefs(); if (S.info && S.type === 'audio') { S.selected = null; renderFormats(); renderOut(); }
});
el.segVideoQ.addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  store.set('mf_defVideo', b.dataset.q); renderPrefs(); if (S.info && S.type === 'video') { S.selected = null; renderFormats(); renderOut(); }
});

let dirTimer;
el.outputDir.addEventListener('input', () => {
  clearTimeout(dirTimer);
  dirTimer = setTimeout(() => {
    const v = el.outputDir.value.trim();
    S.outputDir = v && v !== S.defaultDir ? v : '';
    if (S.outputDir) store.set('mf_outputDir', S.outputDir); else store.del('mf_outputDir');
    renderSbFolder();
    renderOut();
  }, 250);
});
el.outputDir.addEventListener('blur', renderPrefs);
el.btnDefaultDir.addEventListener('click', () => {
  S.outputDir = '';
  store.del('mf_outputDir');
  el.outputDir.value = S.defaultDir;
  renderPrefs();
  renderOut();
});
el.btnOpenDir.addEventListener('click', () => openFolder(currentDir()));

$$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeSet)));
$$('.lang-btn').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* ═══════════════════════════════════════════════════════════════
   Toasts
   ═══════════════════════════════════════════════════════════════ */
function toast({ kind = 'ok', icon: ic, title, sub, action, timeout, go }) {
  if (go && go === S.view) return () => {};
  const icons = { ok: 'check', error: 'alert', warn: 'refresh', info: 'check' };
  const node = h('div', { class: 'toast ' + kind, role: kind === 'error' ? 'alert' : 'status', 'data-go': go || null },
    h('span', { class: 'toast-icon' }, icon(ic || icons[kind] || 'check')),
    h('span', { class: 'toast-body' },
      h('span', { class: 'toast-title' }, title || ''),
      sub ? h('span', { class: 'toast-sub', title: sub }, sub) : null),
    action ? h('button', { class: 'toast-action', onclick: () => { action.fn(); close(); } }, action.label) : null,
    h('button', { class: 'icon-btn', 'aria-label': t('dl_dismiss'), onclick: () => close() }, icon('x')));
  let timer;
  function close() {
    clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 200);
  }
  el.toasts.prepend(node);
  while (el.toasts.children.length > 2) el.toasts.lastElementChild.remove();
  timer = setTimeout(close, timeout || (action ? 5500 : 3500));
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  node.addEventListener('mouseleave', () => { timer = setTimeout(close, 2500); });
  return close;
}

/* ═══════════════════════════════════════════════════════════════
   WebSocket
   ═══════════════════════════════════════════════════════════════ */
let ws, wsRetry = 0, wsTimer;
function renderServer() {
  el.serverPill.classList.toggle('online', S.ws === 'online');
  el.serverPill.classList.toggle('offline', S.ws === 'offline');
  el.serverText.textContent = t(S.ws === 'online' ? 'status_online' : S.ws === 'offline' ? 'status_offline' : 'status_connecting');
}

function connectWS() {
  clearTimeout(wsTimer);
  try {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  } catch { scheduleWS(); return; }
  ws.addEventListener('open', () => {
    const wasOffline = S.ws === 'offline';
    S.ws = 'online'; wsRetry = 0; renderServer();
    if (wasOffline) loadServerInfo();
  });
  ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handleWS(m); });
  ws.addEventListener('close', () => { S.ws = 'offline'; renderServer(); scheduleWS(); });
}
function scheduleWS() { wsTimer = setTimeout(connectWS, Math.min(10000, 1500 * Math.pow(1.5, wsRetry++))); }

function handleWS(msg) {
  switch (msg.type) {
    case 'ytdlp-version':
      S.version = msg.version || S.version; renderVersion(); return;
    case 'update-available':
      S.latest = msg.latest; S.upd = 'available'; renderUpdate();
      toast({ kind: 'warn', title: t('toast_update_available'), sub: msg.latest, go: 'settings', action: { label: t('toast_open_settings'), fn: () => { location.hash = '#/settings'; } } });
      return;
    case 'update-log':
      el.updLog.hidden = false;
      el.updLog.textContent += msg.message || '';
      el.updLog.scrollTop = el.updLog.scrollHeight;
      return;
    case 'update-progress':
      if (S.upd !== 'installing') S.upd = 'installing';
      S.updPct = msg.percent || 0; renderUpdate(); return;
    case 'update-complete':
      if (msg.version) { S.version = msg.version; renderVersion(); }
      S.upd = 'uptodate'; S.latest = ''; S.updPct = 100; renderUpdate();
      if (!msg.alreadyLatest) toast({ kind: 'ok', title: t('toast_updated'), sub: msg.version ? 'yt-dlp ' + msg.version : '' });
      return;
    case 'update-error':
      S.upd = 'error'; renderUpdate();
      toast({ kind: 'error', title: t('toast_update_failed'), sub: msg.message || '' });
      return;
  }
  if (!msg.downloadId) return;
  if (S.dls.has(msg.downloadId)) { applyDlMsg(msg); return; }
  // Message raced ahead of the POST /api/download response — keep it briefly.
  const q = S.pending.get(msg.downloadId) || [];
  q.push(msg);
  S.pending.set(msg.downloadId, q.slice(-50));
  setTimeout(() => S.pending.delete(msg.downloadId), 15000);
}

/* ═══════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════ */
function renderAll() {
  renderServer();
  renderVersion();
  renderFfmpeg();
  renderUpdate();
  renderPrefs();
  renderUrlField();
  if (S.info) { renderPlaylist(); renderFormats(); renderOut(); }
  S.dls.forEach(renderDl);
  renderDlSummary();
  renderHistory();
  renderRecent();
}

// Hide the desktop-only controls when this page is served by a hosted instance.
function applyServerCapabilities() {
  const local = S.cfg.canOpenFolder !== false;
  for (const btn of [el.btnOpenFolder, el.btnOpenDir]) {
    if (btn) btn.hidden = !local;
  }
  if (el.outputDir) {
    const locked = S.cfg.allowCustomDir === false;
    el.outputDir.disabled = locked;
    el.outputDir.title = locked ? t('set_folder_locked') : '';
  }
  renderPrefs();
  renderSbFolder();
  renderKeys();
  loadKeys();
}

function loadServerInfo() {
  api('/api/config').then(({ ok, data }) => {
    if (!ok || !data) return;
    S.cfg = { ...S.cfg, ...data };
    applyServerCapabilities();
    renderOut();
  }).catch(() => {});
  api('/api/ytdlp-version').then(({ data }) => { if (data.version) { S.version = data.version; renderVersion(); } }).catch(() => {});
  api('/api/ffmpeg-status').then(({ data }) => { S.ffmpeg = !!data.available; S.ffmpegPath = data.path || ''; renderFfmpeg(); renderFormats(); renderOut(); }).catch(() => {});
  api('/api/default-dir').then(({ data }) => { S.defaultDir = data.dir || ''; renderPrefs(); renderOut(); }).catch(() => {});
  api('/api/settings').then(({ data }) => { S.autoUpdate = !!data.autoUpdate; renderPrefs(); }).catch(() => {});
  loadHistory();
}

buildPlatforms();
applyTheme();
applyLang(lang);
route();
connectWS();
loadServerInfo();

})();
