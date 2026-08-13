# ↓ indirici

> 🌐 **Language / Dil / Idioma:** [🇺🇸 English](README.md) · [🇹🇷 Türkçe](README.tr.md) · [🇪🇸 Español](README.es.md)

**Una interfaz gráfica local y elegante para [yt-dlp](https://github.com/yt-dlp/yt-dlp) — descarga música y vídeo de YouTube, TikTok, Instagram, SoundCloud y más de 1.000 sitios. Incluye una extensión para Brave/Chrome.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
![Plataforma](https://img.shields.io/badge/plataforma-Windows-0078D4?logo=windows)
![yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-FF0000)
[![Autor](https://img.shields.io/badge/autor-OuzK-orange)](https://github.com/akirasoft)

---

## Características

- **Más de 1.000 sitios compatibles** — YouTube, TikTok, Instagram, SoundCloud, Twitter/X, Vimeo, Twitch y todo lo que soporta yt-dlp
- **Eliminación de marca de agua de TikTok** — descarga el stream limpio y aplica el filtro `delogo` de ffmpeg para borrar la marca de agua grabada
- **Extracción de MP3** — 128 / 192 / 320 kbps, en cualquier plataforma
- **Descarga de MP4** — 360p → 4K, prioridad H.264 (no requiere codec HEVC)
- **Modo editor** — guarda el vídeo (`.mp4` sin audio) y el audio (`.wav`) como archivos separados para DaVinci Resolve / Premiere
- **Soporte de listas de reproducción** — detecta URLs de listas de YouTube/SoundCloud y descarga todos los elementos con progreso por elemento
- **Historial de descargas** — guarda cada descarga completada localmente (`history.json`)
- **Notificaciones del navegador** — notificación de escritorio cuando finaliza una descarga
- **Actualización automática de yt-dlp** — comprueba si hay una versión más nueva en cada inicio del servidor
- **Extensión de navegador** — descarga la pestaña actual con un clic desde Brave o Chrome (interfaz TR / EN / ES)
- **Modo oscuro y claro** — sigue el tema del sistema, tematización completa con variables CSS
- **Progreso en tiempo real** — basado en WebSocket, muestra velocidad, ETA y nombre de archivo en vivo

---

## Requisitos

| Dependencia | Notas |
|---|---|
| [Node.js 18+](https://nodejs.org/) | Entorno de ejecución JavaScript |
| [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) | Opcional pero recomendado — necesario para combinar audio, exportar WAV y eliminar marcas de agua de TikTok. Instalar con WinGet: `winget install Gyan.FFmpeg` |

> yt-dlp se descarga automáticamente en la primera ejecución — no se necesita instalación manual.

---

## Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/akirasoft/indirici.git
cd indirici

# 2. Hacer doble clic en start.bat  (o ejecutar manualmente)
node setup.js   # descarga yt-dlp en bin/
npm install
node server.js
```

El navegador se abre automáticamente en **http://localhost:3434**.

**O simplemente haz doble clic en `start.bat`** — se encarga de todo (descarga de yt-dlp, npm install, inicio del servidor).

---

## Extensión de Navegador

La carpeta `extension/` contiene una extensión Manifest V3 para Brave y Chrome.

**Instalación (modo desarrollador):**

1. Abre `brave://extensions` o `chrome://extensions`
2. Activa el **Modo desarrollador** (interruptor en la esquina superior derecha)
3. Haz clic en **Cargar descomprimida** → selecciona la carpeta `extension/`
4. El icono ↓ aparece en tu barra de herramientas

> La extensión se conecta al servidor local en el puerto 3434. Inicia el servidor primero.

**Idiomas de la interfaz de la extensión:** Turco · Inglés · Español (guardado por navegador)

---

## Estructura del Proyecto

```
indirici/
├── server.js          # Servidor Express + WebSocket, toda la lógica de descarga
├── setup.js           # Descargador único de yt-dlp
├── start.bat          # Lanzador de Windows (setup + npm install + servidor)
├── public/
│   ├── index.html     # Interfaz web principal
│   ├── app.js         # JS del frontend (cliente WebSocket, lógica UI)
│   └── style.css      # Sistema de diseño completo (tokens oscuro/claro)
├── extension/
│   ├── manifest.json  # MV3, permisos: activeTab, tabs, storage
│   ├── popup.html     # Popup de la extensión
│   ├── popup.js       # i18n (TR/EN/ES), cliente WebSocket
│   └── popup.css      # Tema oscuro de la extensión
├── bin/               # yt-dlp.exe reside aquí (gitignored)
└── downloads/         # Carpeta de salida predeterminada (gitignored)
```

---

## Cómo Funciona

```
Navegador / Extensión
      │  HTTP POST /api/download
      ▼
  Servidor Express (puerto 3434)
      │  lanza yt-dlp (o HTTPS directo para TikTok)
      ▼
  yt-dlp / ffmpeg
      │  líneas de progreso analizadas en tiempo real
      ▼
  Difusión WebSocket → todos los clientes conectados
```

**Flujo especial de TikTok:**
1. Obtiene la página embed (`tiktok.com/embed/v2/<id>`) con Node.js `https`
2. Extrae la URL de reproducción `<video src>` (H.264 + AAC combinado, sin autenticación requerida)
3. Descarga el archivo directamente (progreso 0–75%)
4. Ejecuta `ffprobe` para obtener las dimensiones del fotograma
5. Aplica el filtro `ffmpeg delogo` para borrar la región de marca de agua en la esquina inferior derecha
6. Guarda el `.mp4` limpio

---

## Plataformas Compatibles (destacadas)

| Plataforma | Audio | Vídeo | Notas |
|---|---|---|---|
| YouTube | ✅ | ✅ | Listas de reproducción compatibles |
| SoundCloud | ✅ | — | Listas de reproducción compatibles |
| TikTok | ✅ | ✅ | Marca de agua eliminada con delogo |
| Instagram | ✅ | ✅ | Reels, publicaciones |
| Twitter / X | ✅ | ✅ | |
| Vimeo | ✅ | ✅ | |
| Twitch | ✅ | ✅ | Clips y VODs |
| Más de 1.000 | ✅ | ✅ | Todo lo que soporta yt-dlp |

---

## Referencia de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/info` | Obtener metadatos del vídeo y formatos disponibles |
| `POST` | `/api/download` | Iniciar una descarga |
| `POST` | `/api/cancel/:id` | Cancelar una descarga activa |
| `GET` | `/api/history` | Listar el historial de descargas |
| `POST` | `/api/history/clear` | Limpiar el historial |
| `POST` | `/api/playlist-info` | Obtener título y número de elementos de la lista |
| `POST` | `/api/update-ytdlp` | Activar manualmente la actualización de yt-dlp |
| `GET` | `/api/ffmpeg-status` | Comprobar si ffmpeg está disponible |
| `GET` | `/api/default-dir` | Obtener el directorio de descarga predeterminado |
| `WS` | `ws://localhost:3434` | Eventos de progreso en tiempo real |

---

## Eventos WebSocket

```json
{ "type": "filename",      "downloadId": "...", "filename": "cancion.mp3" }
{ "type": "progress",      "downloadId": "...", "percent": 45.2, "speed": "2.1MiB/s", "eta": "00:12" }
{ "type": "status",        "downloadId": "...", "message": "Fusionando..." }
{ "type": "complete",      "downloadId": "..." }
{ "type": "error",         "downloadId": "...", "message": "..." }
{ "type": "cancelled",     "downloadId": "..." }
{ "type": "ytdlp-version", "version": "2026.07.04" }
```

---

## Autor

Creado por **[OuzK](https://github.com/akirasoft)**

---

## Licencia

MIT — ver [LICENSE](LICENSE)
