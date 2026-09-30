# MediaFetch — Sunucu Kurulumu (Ubuntu / Pterodactyl)

Bu döküman, projeyi **SUNUCU_IP** adresindeki sunucuda çalıştırmak ve
Chrome eklentisini o sunucuya bağlamak içindir.

> **Local (Windows) sürüm** hiç bozulmadı; hâlâ `node server.js` ile
> `http://localhost:3434` üzerinde aynı şekilde çalışıyor. Değişiklik öncesi
> tam kopya şurada duruyor:
> `Desktop\projeler\müzik - video indirme - LOCAL-WINDOWS-YEDEK\`

---

## 1. Ne değişti?

| Konu | Önce | Şimdi |
|---|---|---|
| Çalıştığı sistem | Yalnız Windows (`yt-dlp.exe`, `ffmpeg.exe`, WinGet taraması, `explorer`) | Windows + Linux + macOS, otomatik algılama |
| Dinlenen adres | Sabit `127.0.0.1:3434` | `MEDIAFETCH_HOST` / `MEDIAFETCH_PORT`, Pterodactyl'in `SERVER_PORT`'u |
| Güvenlik | Yok (zaten localhost'tu) | `MEDIAFETCH_TOKEN` ile erişim anahtarı (HTTP + WebSocket) |
| İndirilen dosya | Kullanıcının `Downloads` klasörüne düşerdi | Sunucuda indirilir, **HTTP ile kullanıcının bilgisayarına aktarılır** |
| Eklenti | Sabit `localhost:3434` | ⚙ menüsünden adres + anahtar girilebilir; indirme arka planda sürer |
| Kapanış | — | `SIGTERM`'de yt-dlp süreçleri düzgün kapatılır (panel "Stop" düğmesi) |

Kritik nokta: **sunucu senin bilgisayarın değil.** Bu yüzden dosya önce
sunucuya iner, sonra eklenti/web arayüzü onu senin diskine çeker. Eklentide
"Bitince dosyayı bilgisayarıma indir" seçeneği bunu otomatik yapar.

---

## 2. Port seçimi

Varsayılan sunucu portu **8422**.

Bilinçli seçildi: 80/443 (web), 3000/5000/8000/8080/8888 (uygulama),
3306 (MySQL), 2022/8080 (Pterodactyl wings/panel), 25565 (Minecraft) —
hiçbiriyle çakışmaz.

Sunucuda boş olduğunu doğrula:

```bash
ss -lntp | grep -E ':(80|8422|3434)\b' || echo "8422 bos"
```

Pterodactyl kullanıyorsan portu **panel verir** (`SERVER_PORT`); `MEDIAFETCH_PORT`
değişkenini orada boş bırak.

---

## 3. Yol A — Pterodactyl (senin durumun)

### 3.1 Allocation (port) ekle
Panel → **Admin** → Nodes → ilgili node → **Allocations** →
IP `SUNUCU_IP`, Port `8422` → *Submit*.

### 3.2 Egg'i içeri aktar
Panel → **Admin** → Nests → **Import Egg** →
`deploy/pterodactyl-egg-mediafetch.json` dosyasını yükle.

### 3.3 Sunucu oluştur
- **Egg:** MediaFetch
- **Docker image:** `ghcr.io/parkervcp/yolks:nodejs_22`
- **Allocation:** az önce eklediğin `SUNUCU_IP:8422`
- **Disk:** en az 5 GB (indirilen dosyalar burada birikir)
- **RAM:** 1 GB yeterli (ffmpeg birleştirme sırasında kısa süreli artar)

**Variables** sekmesi:

| Değişken | Değer |
|---|---|
| `MEDIAFETCH_TOKEN` | uzun rastgele bir anahtar (aşağıya bak) |
| `MEDIAFETCH_MODE` | `server` |
| `MEDIAFETCH_PUBLIC_URL` | `http://ornek.duckdns.org:8422` |
| `MEDIAFETCH_RETENTION_MIN` | `1440` (dosyalar 24 saat sonra silinir) |
| `GIT_REPO` | deponun varsa adresi, yoksa boş |

Anahtar üretmek için (kendi bilgisayarında da çalışır):

```bash
openssl rand -hex 24
```

### 3.4 Dosyaları yükle
`GIT_REPO` doldurduysan kurulum kodu kendisi çeker. Doldurmadıysan panelin
**Files** sekmesinden şunları yükle (bir zip atıp "Unarchive" en kolayı):

```
server.js  package.json  package-lock.json  public/  scripts/
```

`node_modules/`, `bin/`, `downloads/` yükleme — kurulum bunları kendisi yapar.

### 3.5 Başlat
Startup Command zaten şu olmalı:

```
sh scripts/start.sh
```

**Start**'a bas. Konsolda şunu görmelisin:

```
mode: server · linux/x64 · node 22.x
yt-dlp: /home/container/bin/yt-dlp
ffmpeg found: /home/container/bin
Listening on 0.0.0.0:8422
Auth: enabled (MEDIAFETCH_TOKEN)
```

Tarayıcıdan kontrol:
`http://ornek.duckdns.org:8422/login?t=ANAHTARIN`

---

## 4. Yol B — Düz Ubuntu (Pterodactyl olmadan)

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm ffmpeg curl

sudo useradd -r -m -d /opt/mediafetch -s /usr/sbin/nologin mediafetch
sudo mkdir -p /opt/mediafetch
# proje dosyalarını /opt/mediafetch içine kopyala, sonra:
sudo chown -R mediafetch:mediafetch /opt/mediafetch

cd /opt/mediafetch
sudo -u mediafetch sh scripts/install-linux.sh

sudo -u mediafetch cp .env.example .env
sudo -u mediafetch nano .env          # MEDIAFETCH_TOKEN'i doldur

sudo cp deploy/mediafetch.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mediafetch
sudo journalctl -u mediafetch -f
```

Güvenlik duvarı:

```bash
sudo ufw allow 8422/tcp
sudo ufw status
```

---

## 5. Yol C — Docker

```bash
cp .env.example .env && nano .env      # MEDIAFETCH_TOKEN
docker compose up -d
docker compose logs -f
```

---

## 6. Adres meselesi — neden `:8422`?

Sunucuyu kontrol ettim (27.09.2026):

```
http://SUNUCU_IP/       -> Pterodactyl paneli (nginx/1.18.0, Laravel)
http://SUNUCU_IP:8080/  -> Wings (panel daemon)
http://ornek.duckdns.org:8422/  -> boş
```

Yani **80 portunun kökü zaten panelin kendisi**. Oraya MediaFetch'i koymak
paneli erişilemez yapar. Doğru adres:

```
http://ornek.duckdns.org:8422
```

Kesinlikle 80 portundan görünmesini istiyorsan iki seçeneğin var:

1. **Alt alan adı** (önerilen): bir alan adını sunucuya yönlendir,
   `deploy/nginx-mediafetch.conf` içindeki `server_name` satırını onunla
   değiştir, ardından:

   ```bash
   sudo cp deploy/nginx-mediafetch.conf /etc/nginx/sites-available/mediafetch
   sudo ln -s /etc/nginx/sites-available/mediafetch /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

   `nginx -t` "unknown variable connection_upgrade" derse
   `/etc/nginx/nginx.conf` içindeki `http { }` bloğuna şunu ekle:

   ```nginx
   map $http_upgrade $connection_upgrade { default upgrade; '' close; }
   ```

2. **Paneli başka porta taşımak** — riskli, tavsiye etmem.

> Alt **dizin** (ör. `/mediafetch/`) çalışmaz: arayüz `/api/...` gibi kök
> yolları kullanıyor. Port ya da alt alan adı kullan.

---

## 7. Chrome eklentisi

1. Chrome → `chrome://extensions` → sağ üstten **Geliştirici modu** açık.
2. **Paketlenmemiş öğe yükle** → `extension/` klasörünü seç.
3. Araç çubuğundaki MediaFetch simgesine tıkla → sağ üstteki **⚙**.
4. Ayarlar:
   - **Sunucu adresi:** `http://ornek.duckdns.org:8422`
     (hazır **Sunucu (8422)** düğmesi bunu doldurur)
   - **Erişim anahtarı:** `MEDIAFETCH_TOKEN` değerin
   - **Bitince dosyayı bilgisayarıma indir:** işaretli kalsın
5. **Kaydet**. Chrome bir kez "bu siteye erişim" izni soracak → **İzin ver**.
   Sağ üstteki nokta **yeşil** olmalı.

Kullanım: indirmek istediğin sayfadayken simgeye tıkla → MP3/MP4 ve kalite seç
→ **İndir**. Dosya sunucuda hazırlanır, biter bitmez otomatik olarak Chrome'un
indirilenler klasörüne düşer. **Popup'ı kapatsan bile devam eder** — indirme
artık arka plan service worker'ında yürüyor.

Local sunucuya dönmek istersen: ⚙ → **Local (3434)** → anahtarı boşalt → Kaydet.

---

## 8. Güvenlik notları

- `MEDIAFETCH_TOKEN` **boş bırakılmamalı**. Açık IP'de anahtarsız bir kurulum,
  porta ulaşan herkesin senin sunucunda yt-dlp çalıştırabilmesi demektir.
  Anahtar yoksa sunucu açılışta uyarı basar.
- Sunucu modunda istemci **kayıt klasörü seçemez**; her şey sabit indirme
  klasörüne yazılır (uzak kullanıcı sunucuda yol seçemesin diye).
- Trafik HTTP (şifresiz). Alan adın varsa Let's Encrypt ile HTTPS'e geçmek
  anahtarın ağda açık gitmesini önler:
  `sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx`
- Dosyalar varsayılan olarak 24 saat sonra silinir (`MEDIAFETCH_RETENTION_MIN`).
  Diskin dolmaması için bunu kapatma; kapatacaksan disk kotasını takip et.

---

## 9. Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| `Port ... is already in use` | Başka bir servis o portta. `ss -lntp` ile bak, `MEDIAFETCH_PORT` değiştir. |
| `Not allowed to bind port 80` | 1024 altı port root ister. Yüksek port + nginx kullan. |
| `yt-dlp NOT FOUND` | `sh scripts/install-linux.sh` çalıştır. |
| `ffmpeg not found` | MP3 ve birleştirme çalışmaz. `sudo apt-get install -y ffmpeg` ya da `MEDIAFETCH_FORCE_FFMPEG=1 sh scripts/install-linux.sh`. |
| Eklentide nokta kırmızı, "Sunucuya ulaşılamıyor" | Adres/port yanlış, güvenlik duvarı kapalı ya da uygulama durmuş. `curl http://ornek.duckdns.org:8422/api/health` ile dene. |
| Eklentide "Erişim anahtarı hatalı" | ⚙'deki anahtar ile `MEDIAFETCH_TOKEN` birebir aynı olmalı. |
| Web arayüzü açılıyor ama ilerleme çubuğu donuk | WebSocket engelleniyor. nginx kullanıyorsan `Upgrade`/`Connection` başlıkları ve `proxy_read_timeout` ayarlı mı bak. |
| YouTube'da "format bulunamadı" | Konteynerde Node var, sorun değil; yine de olursa panelden yt-dlp'yi güncelle (Ayarlar → Güncelle). |
| İndirme bitti ama dosya bilgisayara gelmedi | Eklentide ⚙ → "Bitince dosyayı bilgisayarıma indir" işaretli mi? İşaretli değilse ilerleme kutusundaki **⬇ Bilgisayarıma indir** düğmesini kullan. |

---

## 10. Ortam değişkenleri özeti

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MEDIAFETCH_MODE` | otomatik | `server` / `local` |
| `MEDIAFETCH_PORT` | 8422 (server) / 3434 (local) | Port. Pterodactyl'de `SERVER_PORT` kazanır. |
| `MEDIAFETCH_HOST` | `0.0.0.0` / `127.0.0.1` | Dinlenen adres |
| `MEDIAFETCH_TOKEN` | — | Erişim anahtarı |
| `MEDIAFETCH_PUBLIC_URL` | — | Dış adres (loglarda ve yönlendirmede) |
| `MEDIAFETCH_DOWNLOAD_DIR` | `./downloads` | Sunucudaki indirme klasörü |
| `MEDIAFETCH_RETENTION_MIN` | 1440 | Dosya saklama süresi (0 = sınırsız) |
| `MEDIAFETCH_ALLOWED_ORIGINS` | — | Ek CORS kaynakları (virgüllü) |
| `MEDIAFETCH_YTDLP` | — | yt-dlp yolunu elle ver |
| `MEDIAFETCH_FFMPEG` | — | ffmpeg yolunu elle ver |
