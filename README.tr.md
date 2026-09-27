# MediaFetch

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

> 🖥️ **Bu sürüm sunucu / VPS içindir** — Ubuntu, Docker veya Pterodactyl'a kur, arkadaşlarınla paylaş. Her kişiye ayrı erişim anahtarı ver; indirilen dosyalar doğrudan onların bilgisayarına gider, sunucuda hiçbir şey kalmaz.  
> 💻 Kendi Windows bilgisayarında yerel çalıştırmak istiyorsan → **[mediafetch-local](https://github.com/akirasoft/mediafetch-local)**

YouTube, TikTok, Instagram, SoundCloud ve 1000+ siteden müzik/video indirme aracı.  
Kendi sunucuna (VPS/VDS) kurarsın, arkadaşlarına kişisel anahtar verirsin; indirilen dosyalar doğrudan onların bilgisayarına gider — sunucuda hiçbir şey kalmaz.

---

## Nasıl Çalışır?

```
Kullanıcı → Tarayıcı / Chrome Eklentisi
                 ↓
         MediaFetch Sunucusu (senin VPS'in)
                 ↓
        yt-dlp ile video indirilir
                 ↓
     Dosya kullanıcının tarayıcısına gönderilir
                 ↓
         Kullanıcının bilgisayarına iner
   (Sunucuda hiçbir şey kalmaz — anında silinir)
```

---

## Gereksinimler

| | Minimum |
|---|---|
| İşletim sistemi | Ubuntu 20.04+ / Debian 11+ |
| RAM | 512 MB |
| Disk | 2 GB |
| Node.js | 18+ |
| yt-dlp | Otomatik kurulur |
| ffmpeg | Otomatik kurulur |

---

## Kurulum (Ubuntu / Debian)

### 1. Node.js kur

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v22.x.x görmeli
```

### 2. Projeyi indir

```bash
git clone https://github.com/akirasoft/mediafetch.git
cd mediafetch
npm install --omit=dev
```

### 3. yt-dlp ve ffmpeg kur

```bash
bash scripts/install-linux.sh
```

Bu script:
- Doğru mimariye göre yt-dlp indirir ve SHA256 doğrular
- ffmpeg statik derlemesini kurar
- Her ikisini `bin/` klasörüne yerleştirir

### 4. Ortam değişkenlerini ayarla

```bash
cp .env.example .env
nano .env
```

`.env` dosyasını düzenle:

```env
# Sahip şifresi — en az 24 karakter, rastgele bir şey yaz
MEDIAFETCH_TOKEN=buraya_guclu_bir_sifre_yaz

# Dinlenecek port (güvenlik duvarında açık olmalı)
SERVER_PORT=8422

# Sunucunun dışarıdan erişilen adresi (subdomain varsa onu yaz)
MEDIAFETCH_PUBLIC_URL=http://SUNUCU_IP_ADRESI:8422

# Dosya saklama süresi (dakika) — 0 = saklamaz, anında siler
MEDIAFETCH_RETENTION_MIN=0
```

### 5. Başlat

```bash
node server.js
```

Çıktıda şunu görmelisin:
```
✓ MediaFetch sunucu modunda çalışıyor
✓ http://0.0.0.0:8422 adresinde dinleniyor
✓ Giriş: http://SUNUCU_IP:8422/login?t=...
```

---

## Arka Planda Çalıştırma (PM2)

Terminali kapattığında sunucu durmaya devam etmek için:

```bash
sudo npm install -g pm2
pm2 start server.js --name mediafetch
pm2 startup          # Sunucu yeniden başlayınca otomatik başlasın
pm2 save
```

Yararlı komutlar:

```bash
pm2 logs mediafetch    # Canlı log
pm2 restart mediafetch # Yeniden başlat
pm2 stop mediafetch    # Durdur
```

---

## Docker ile Kurulum (Alternatif)

```bash
cp .env.example .env
# .env dosyasını düzenle (yukarıdaki gibi)

docker compose up -d
```

Durdur:
```bash
docker compose down
```

---

## Güvenlik Duvarı

Portu dışarıya aç (UFW kullanıyorsan):

```bash
sudo ufw allow 8422/tcp
sudo ufw reload
```

---

## HTTPS Almak (Ücretsiz — Cloudflare Tunnel)

Sabit IP yoksa veya HTTPS isteniyorsa `.env` içine ekle:

```env
MEDIAFETCH_TUNNEL=1
```

Sunucu yeniden başlayınca `https://xxxx.trycloudflare.com` şeklinde bir adres üretir.  
**Not:** Ücretsiz tünelin adresi her yeniden başlatmada değişir. Sabit adres için `MEDIAFETCH_PUBLIC_URL` ile HTTP adresini kullan.

---

## Arkadaşlara Erişim Vermek

1. Sahip anahtarınla giriş yap: `http://SUNUCU_IP:8422/login?t=SENIN_TOKEN`
2. **Ayarlar → Erişim Anahtarları**
3. Arkadaşın adını yaz → **Oluştur**
4. Zincir simgesine (🔗) tıkla → linki kopyala → arkadaşına gönder

Her kişinin ayrı anahtarı vardır:
- Kimin ne indirdiği geçmişte görünür
- Birini iptal etmek diğerlerini etkilemez
- Anahtarlar sunucu yeniden başlayınca silinmez

---

## Chrome / Brave Eklentisi

### Kurulum

1. `brave://extensions` veya `chrome://extensions` aç
2. **Geliştirici modu** → AÇ
3. **Paketlenmemiş öğe yükle** → `extension/` klasörünü seç
4. Eklenti simgesi → ⚙ Ayarlar:

| Alan | Değer |
|---|---|
| Sunucu URL | `http://SUNUCU_IP:8422` |
| Token | Kendi anahtarın |
| Otomatik kaydet | ✅ |

### Kullanım

YouTube / TikTok / Instagram / SoundCloud sayfasına git →  
Sağ altta **mor ↓ butonu** belirir → tıkla → format seç → dosya bilgisayarına iner.

Desteklenen siteler: YouTube, YouTube Shorts, TikTok, Instagram Reels,  
Twitter/X videoları, SoundCloud, Vimeo ve yt-dlp'nin desteklediği 1000+ site.

---

## Ortam Değişkenleri (Tam Liste)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MEDIAFETCH_TOKEN` | — | **Zorunlu** — sahip şifresi |
| `SERVER_PORT` | `8422` | Dinlenecek port |
| `MEDIAFETCH_PUBLIC_URL` | — | Dışarıdan erişilen adres |
| `MEDIAFETCH_RETENTION_MIN` | `0` | Dosya saklama süresi (dk), 0 = anında sil |
| `MEDIAFETCH_TUNNEL` | `0` | `1` = Cloudflare tüneli başlat |
| `MEDIAFETCH_DOWNLOAD_DIR` | `downloads/` | İndirme klasörü |
| `MEDIAFETCH_MODE` | otomatik | `server` veya `local` |

---

## Testler

```bash
npm test
```

66 test: TikTok indirme (32), sunucu modları (18), erişim anahtarları (16).

---

## Yerel Kurulum (Windows / macOS)

Sunucu kurmak istemiyorsan, kendi bilgisayarında çalışan sürüm için:

👉 **[mediafetch-local](https://github.com/akirasoft/mediafetch-local)** — Node.js, yt-dlp ve Brave eklentisi dahil; tek başına çalışır.

---

## Lisans

MIT — ticari kullanım dahil serbestçe kullanılabilir.  
yt-dlp ve ffmpeg kendi lisanslarına tabidir.
