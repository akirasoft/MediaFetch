# MediaFetch

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

Descarga música y vídeo de YouTube, TikTok, Instagram, SoundCloud y más de 1.000 sitios.  
Instálalo en tu propio servidor (VPS), da claves de acceso personales a tus amigos — los archivos van directamente a **su** ordenador, nada queda en el servidor.

---

## Cómo Funciona

```
Usuario → Navegador / Extensión de Chrome
                ↓
     Servidor MediaFetch (tu VPS)
                ↓
      yt-dlp descarga el archivo
                ↓
  El archivo se envía al navegador del usuario
                ↓
     Se guarda en su ordenador
  (se borra del servidor al instante)
```

---

## Requisitos

| | Mínimo |
|---|---|
| Sistema operativo | Ubuntu 20.04+ / Debian 11+ |
| RAM | 512 MB |
| Disco | 2 GB |
| Node.js | 18+ |
| yt-dlp | se instala automáticamente |
| ffmpeg | se instala automáticamente |

---

## Instalación (Ubuntu / Debian)

### 1. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # debe mostrar v22.x.x
```

### 2. Clonar el proyecto

```bash
git clone https://github.com/akirasoft/mediafetch.git
cd mediafetch
npm install --omit=dev
```

### 3. Instalar yt-dlp y ffmpeg

```bash
bash scripts/install-linux.sh
```

Este script:
- Descarga yt-dlp para tu arquitectura y verifica el SHA256
- Instala una compilación estática de ffmpeg
- Coloca ambos en el directorio `bin/`

### 4. Configurar las variables de entorno

```bash
cp .env.example .env
nano .env
```

Edita `.env`:

```env
# Contraseña del propietario — al menos 24 caracteres aleatorios
MEDIAFETCH_TOKEN=reemplaza_con_una_contraseña_segura

# Puerto a escuchar (debe estar abierto en el firewall)
SERVER_PORT=8422

# Dirección pública del servidor (usa un subdominio si tienes uno)
MEDIAFETCH_PUBLIC_URL=http://TU_IP_DE_SERVIDOR:8422

# Retención de archivos en minutos — 0 = borrar inmediatamente
MEDIAFETCH_RETENTION_MIN=0
```

### 5. Iniciar

```bash
node server.js
```

Deberías ver:
```
✓ MediaFetch running in server mode
✓ Listening on http://0.0.0.0:8422
✓ Login: http://TU_IP:8422/login?t=...
```

---

## Ejecutar en Segundo Plano (PM2)

Para mantener el servidor activo al cerrar el terminal:

```bash
sudo npm install -g pm2
pm2 start server.js --name mediafetch
pm2 startup          # inicio automático al reiniciar
pm2 save
```

Comandos útiles:

```bash
pm2 logs mediafetch    # logs en tiempo real
pm2 restart mediafetch # reiniciar
pm2 stop mediafetch    # detener
```

---

## Docker (Alternativa)

```bash
cp .env.example .env
# edita .env como se indica arriba

docker compose up -d
```

Detener:
```bash
docker compose down
```

---

## Firewall

Abrir el puerto (UFW):

```bash
sudo ufw allow 8422/tcp
sudo ufw reload
```

---

## HTTPS Gratuito (Cloudflare Tunnel)

¿Sin IP estática o quieres HTTPS? Agrega a `.env`:

```env
MEDIAFETCH_TUNNEL=1
```

Al reiniciar, el servidor imprime una URL `https://xxxx.trycloudflare.com`.  
**Nota:** La URL del túnel gratuito cambia en cada reinicio. Para una dirección estable, establece `MEDIAFETCH_PUBLIC_URL` con una dirección HTTP.

---

## Dar Acceso a Amigos

1. Inicia sesión con tu token de propietario: `http://TU_IP:8422/login?t=TU_TOKEN`
2. **Ajustes → Claves de acceso**
3. Escribe un nombre → **Crear**
4. Haz clic en el icono de cadena (🔗) → copia el enlace → envíaselo a tu amigo

Cada persona tiene su propia clave:
- Puedes ver quién descargó qué en el historial
- Revocar una clave no afecta a las demás
- Las claves sobreviven a los reinicios del servidor

---

## Extensión Chrome / Brave

### Instalación

1. Abre `brave://extensions` o `chrome://extensions`
2. **Modo desarrollador** → ACTIVAR
3. **Cargar descomprimida** → selecciona la carpeta `extension/`
4. Haz clic en el icono de la extensión → ⚙ Ajustes:

| Campo | Valor |
|---|---|
| URL del servidor | `http://TU_IP:8422` |
| Token | Tu clave de acceso |
| Guardado automático | ✅ |

### Uso

Ve a una página de YouTube / TikTok / Instagram / SoundCloud →  
Aparece un **botón morado ↓** abajo a la derecha → haz clic → elige formato → el archivo se descarga en tu ordenador.

Compatible con: YouTube, YouTube Shorts, TikTok, Instagram Reels,  
vídeos de Twitter/X, SoundCloud, Vimeo y más de 1.000 sitios soportados por yt-dlp.

---

## Variables de Entorno

| Variable | Predeterminado | Descripción |
|---|---|---|
| `MEDIAFETCH_TOKEN` | — | **Obligatorio** — contraseña del propietario |
| `SERVER_PORT` | `8422` | Puerto a escuchar |
| `MEDIAFETCH_PUBLIC_URL` | — | Dirección accesible públicamente |
| `MEDIAFETCH_RETENTION_MIN` | `0` | Retención de archivos (minutos), 0 = borrado inmediato |
| `MEDIAFETCH_TUNNEL` | `0` | `1` = iniciar túnel Cloudflare |
| `MEDIAFETCH_DOWNLOAD_DIR` | `downloads/` | Directorio de descargas |
| `MEDIAFETCH_MODE` | auto | `server` o `local` |

---

## Tests

```bash
npm test
```

66 tests: descargas TikTok (32), modos de servidor (18), claves de acceso (16).

---

## Instalación Local (Windows / macOS)

¿No quieres un servidor? Hay una versión local independiente:

👉 **[mediafetch-local](https://github.com/akirasoft/mediafetch-local)** — se ejecuta completamente en tu propio ordenador, incluye yt-dlp, ffmpeg y la extensión del navegador.

---

## Licencia

MIT — libre para uso comercial.  
yt-dlp y ffmpeg están sujetos a sus propias licencias.
