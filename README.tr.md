# ↓ MediaFetch

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

**[yt-dlp](https://github.com/yt-dlp/yt-dlp) için şık, yerel çalışan bir arayüz — YouTube, TikTok, Instagram, SoundCloud ve 1.000'den fazla siteden müzik & video indirin. Brave/Chrome tarayıcı eklentisiyle birlikte gelir.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Lisans](https://img.shields.io/badge/lisans-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows)
![yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-FF0000)
[![Yapımcı](https://img.shields.io/badge/yap%C4%B1mc%C4%B1-OuzK-orange)](https://github.com/akirasoft)

---

> ⚠️ **Yasal Uyarı:** Bu araç yalnızca indirme hakkına sahip olduğunuz içerikler için tasarlanmıştır — kamu malı, Creative Commons lisanslı içerikler veya telif hakkı sahibinin izin verdiği materyaller. Telif hakkıyla korunan içeriklerin yetkisiz indirilmesi, platformun Kullanım Koşulları'nı ve geçerli telif hakkı mevzuatını ihlal edebilir. **Bu yazılımı nasıl kullandığınızdan yalnızca siz sorumlusunuz.** Yapımcı bu aracı olduğu gibi sunar; kötüye kullanımdan doğacak hiçbir sorumluluk kabul edilmez.

## Özellikler

- **1.000'den fazla site desteği** — YouTube, TikTok, Instagram, SoundCloud, Twitter/X, Vimeo, Twitch ve yt-dlp'nin desteklediği her şey
- **TikTok filigran kaldırma** — temiz oynatma akışını indirir, ffmpeg `delogo` filtresiyle içine işlenmiş filigranı siler
- **MP3 çıkarma** — 128 / 192 / 320 kbps, her platformda
- **MP4 indirme** — 360p → 4K, H.264 öncelikli (HEVC codec gerekmez)
- **Editör modu** — DaVinci Resolve / Premiere için sessiz `.mp4` video ve `.wav` sesi ayrı dosya olarak kaydeder
- **Oynatma listesi desteği** — YouTube/SoundCloud playlist URL'lerini algılar, tüm öğeleri her biri için ilerleme göstererek indirir
- **İndirme geçmişi** — tamamlanan her indirmeyi yerel olarak kaydeder (`history.json`)
- **Tarayıcı bildirimleri** — indirme tamamlandığında masaüstü bildirimi gönderir
- **Otomatik yt-dlp güncelleme** — her sunucu başlatmada yeni sürüm kontrolü yapar
- **Tarayıcı eklentisi** — Brave veya Chrome'da mevcut sekmeyi tek tıkla indir (TR / EN / ES arayüz)
- **Koyu & açık tema** — sistem temasını takip eder, tam CSS-değişken teması
- **Gerçek zamanlı ilerleme** — WebSocket tabanlı, hız, ETA ve dosya adını canlı gösterir

---

## Gereksinimler

| Bağımlılık | Notlar |
|---|---|
| [Node.js 18+](https://nodejs.org/) | JavaScript çalışma ortamı |
| [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) | İsteğe bağlı ama önerilir — ses birleştirme, WAV çıktısı, TikTok filigran kaldırma için gerekli. WinGet ile kurulum: `winget install Gyan.FFmpeg` |

> yt-dlp ilk çalıştırmada otomatik indirilir — manuel kurulum gerekmez.

---

## Hızlı Başlangıç

```bash
# 1. Repoyu klonla
git clone https://github.com/akirasoft/mediafetch.git
cd mediafetch

# 2. start.bat'a çift tıkla  (veya manuel çalıştır)
node setup.js   # yt-dlp'yi bin/ klasörüne indirir
npm install
node server.js
```

Tarayıcı otomatik olarak **http://localhost:3434** adresinde açılır.

**Ya da sadece `start.bat`'a çift tıkla** — her şeyi halleder (yt-dlp indirme, npm install, sunucu başlatma).

---

## Tarayıcı Eklentisi

`extension/` klasörü, Brave ve Chrome için Manifest V3 eklentisi içerir.

**Kurulum (geliştirici modu):**

1. `brave://extensions` veya `chrome://extensions` adresini aç
2. Sağ üstte **Geliştirici modu**nu etkinleştir
3. **Paketlenmemişi yükle** → `extension/` klasörünü seç
4. Araç çubuğunda ↓ simgesi görünür

> Eklenti, 3434 portundaki yerel sunucuya bağlanır. Önce sunucuyu başlatın.

**Eklenti arayüz dilleri:** Türkçe · İngilizce · İspanyolca (tarayıcı başına kaydedilir)

---

## Proje Yapısı

```
mediafetch/
├── server.js          # Express + WebSocket sunucusu, tüm indirme mantığı
├── setup.js           # Tek seferlik yt-dlp indirici
├── start.bat          # Windows başlatıcı (kurulum + npm install + sunucu)
├── public/
│   ├── index.html     # Ana web arayüzü
│   ├── app.js         # Ön yüz JS (WebSocket istemcisi, UI mantığı)
│   └── style.css      # Tam tasarım sistemi (koyu/açık token'lar)
├── extension/
│   ├── manifest.json  # MV3, izinler: activeTab, tabs, storage
│   ├── popup.html     # Eklenti popup'ı
│   ├── popup.js       # i18n (TR/EN/ES), WebSocket istemcisi
│   └── popup.css      # Koyu eklenti teması
├── bin/               # yt-dlp.exe burada bulunur (gitignored)
└── downloads/         # Varsayılan çıktı klasörü (gitignored)
```

---

## Nasıl Çalışır

```
Tarayıcı / Eklenti
      │  HTTP POST /api/download
      ▼
  Express sunucusu (port 3434)
      │  yt-dlp başlatır (TikTok için direkt HTTPS)
      ▼
  yt-dlp / ffmpeg
      │  ilerleme satırları gerçek zamanlı ayrıştırılır
      ▼
  WebSocket yayını → tüm bağlı istemciler
```

**TikTok özel akışı:**
1. Node.js `https` ile embed sayfasını (`tiktok.com/embed/v2/<id>`) çeker
2. `<video src>` oynatma URL'ini ayıklar (birleşik H.264 + AAC, kimlik doğrulama gerekmez)
3. Dosyayı doğrudan indirir (0–75% ilerleme)
4. Kare boyutlarını almak için `ffprobe` çalıştırır
5. Sağ alt köşedeki filigran bölgesini silmek için `ffmpeg delogo` filtresi uygular
6. Temiz `.mp4` dosyasını kaydeder

---

## Desteklenen Platformlar (öne çıkanlar)

| Platform | Ses | Video | Notlar |
|---|---|---|---|
| YouTube | ✅ | ✅ | Oynatma listesi desteklenir |
| SoundCloud | ✅ | — | Oynatma listesi desteklenir |
| TikTok | ✅ | ✅ | Filigran delogo ile kaldırılır |
| Instagram | ✅ | ✅ | Reels, gönderiler |
| Twitter / X | ✅ | ✅ | |
| Vimeo | ✅ | ✅ | |
| Twitch | ✅ | ✅ | Klipler & VOD'lar |
| 1.000'den fazlası | ✅ | ✅ | yt-dlp'nin desteklediği her şey |

---

## API Referansı

| Yöntem | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/info` | Video meta verisi ve mevcut formatları al |
| `POST` | `/api/download` | İndirme başlat |
| `POST` | `/api/cancel/:id` | Aktif indirmeyi iptal et |
| `GET` | `/api/history` | İndirme geçmişini listele |
| `POST` | `/api/history/clear` | Geçmişi temizle |
| `POST` | `/api/playlist-info` | Playlist başlığı ve öğe sayısını al |
| `POST` | `/api/update-ytdlp` | yt-dlp güncellemesini manuel tetikle |
| `GET` | `/api/ffmpeg-status` | ffmpeg'in mevcut olup olmadığını kontrol et |
| `GET` | `/api/default-dir` | Varsayılan indirme dizinini al |
| `WS` | `ws://localhost:3434` | Gerçek zamanlı ilerleme olayları |

---

## WebSocket Olayları

```json
{ "type": "filename",      "downloadId": "...", "filename": "sarki.mp3" }
{ "type": "progress",      "downloadId": "...", "percent": 45.2, "speed": "2.1MiB/s", "eta": "00:12" }
{ "type": "status",        "downloadId": "...", "message": "Birleştiriliyor..." }
{ "type": "complete",      "downloadId": "..." }
{ "type": "error",         "downloadId": "...", "message": "..." }
{ "type": "cancelled",     "downloadId": "..." }
{ "type": "ytdlp-version", "version": "2026.07.04" }
```

---

## Yapımcı

**[OuzK](https://github.com/akirasoft)** tarafından yapılmıştır

---

## Lisans

MIT — [LICENSE](LICENSE) dosyasına bakın
