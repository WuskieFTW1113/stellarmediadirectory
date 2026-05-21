# Stellar Media Library

A self-hosted music streaming server built on nginx + fancyindex with on-the-fly FFmpeg transcoding, Dolby Atmos detection, Discord/Lavalink support, and a custom dark web player.

![Stellar Media Library](fancyindex/logo.png)

## Features

- **Dark web UI** — custom fancyindex theme with sticky search, track count, and file browser
- **Embedded audio player** — play/pause, prev/next, shuffle, repeat, seek, volume
- **Real codec detection** — ffprobe reads actual stream metadata to show accurate format badges (Dolby Atmos, DTS:X, TrueHD, Lossless, Surround)
- **On-the-fly transcoding** — EAC-3, AC-3, TrueHD, DTS, M4A, AIFF, ALAC, WMA all transcode to 320kbps MP3 for browser playback
- **Discord / Lavalink** — transcode endpoint with `Content-Length` for seeking, ITU-R downmix for surround-to-stereo
- **Discord embeds** — Discordbot gets a rich OG embed with track info and logo; browsers/bots get the audio stream
- **M3U playlists** — per-folder or full-library playlists with auto-routed transcode URLs
- **Track menu** — click any track to choose: play in browser, copy Discord URL, or copy direct URL

## Supported Formats

See [docs/CODEC_SUPPORT.md](docs/CODEC_SUPPORT.md) for full details.

| Category | Formats |
|----------|---------|
| Native browser | MP3, FLAC, OGG, OPUS, WAV |
| Transcoded | M4A, AAC, EAC-3, AC-3, TrueHD, DTS, DTS-HD, WMA, AIFF, ALAC |
| Immersive audio | Dolby Atmos (EAC-3/TrueHD), DTS:X |

## Requirements

- Debian/Ubuntu Linux
- nginx with `libnginx-mod-http-fancyindex`
- Node.js 18+
- FFmpeg with libmp3lame
- CIFS mount or local path for your music library

## Installation

### 1. Install dependencies
```bash
apt install nginx libnginx-mod-http-fancyindex ffmpeg nodejs -y
```

### 2. Mount your music library
```bash
# On the Proxmox HOST (recommended for LXC containers)
mkdir -p /mnt/media
echo '//192.168.x.x/share /mnt/media cifs username=user,password=pass,uid=1000,gid=1000,file_mode=0777,dir_mode=0777,vers=3.0,_netdev 0 0' >> /etc/fstab
mount -a

# Add bind mount to LXC config
echo 'mp0: /mnt/media,mp=/var/www/html/Music' >> /etc/pve/lxc/<CTID>.conf
pct restart <CTID>
```

### 3. Deploy fancyindex assets
```bash
mkdir -p /var/www/html/fancyindex
cp fancyindex/header.html /var/www/html/fancyindex/
cp fancyindex/footer.html /var/www/html/fancyindex/
cp fancyindex/logo.png /var/www/html/fancyindex/
```

### 4. Deploy nginx config
```bash
cp nginx/default /etc/nginx/sites-available/default
nginx -t && systemctl reload nginx
```

### 5. Deploy transcode server
```bash
mkdir -p /var/www/transcode
cp transcode/server.js /var/www/transcode/
```

Edit `MUSIC_ROOT` and `BASE_URL` in `server.js` to match your setup:
```javascript
const MUSIC_ROOT = '/path/to/your/music'; // path to your actual music files
const BASE_URL = 'https://your-domain.com';      // your public URL
```

### 6. Install as a systemd service
```bash
cp transcode/stellar-media.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable stellar-media
systemctl start stellar-media
```

### 7. Verify
```bash
# Check transcode server is running
curl -I http://localhost:3000/transcode/Artist/Album/track.m4a

# Check nginx is proxying correctly
curl -I https://your-domain.com/transcode/Artist/Album/track.m4a
```

## Configuration

### server.js
| Variable | Default | Description |
|----------|---------|-------------|
| `MUSIC_ROOT` | `/path/to/your/music` | Absolute path to music files |
| `BASE_URL` | `https://your-domain.com` | Public base URL for M3U/OG embeds |
| `PORT` | `3000` | Port for transcode server |
| `BITRATE` | `320000` | Output bitrate for transcoded streams |

### Changing the downmix filter
The surround downmix uses ITU-R BS.775 by default. Edit the `-af` argument in `server.js`:
```javascript
'-af', 'aresample=resampler=swr,pan=stereo|FL<FL+0.707*FC+0.707*BL+0.5*LFE|FR<FR+0.707*FC+0.707*BR+0.5*LFE',
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /Music/` | Browse music library |
| `GET /transcode/<path>` | Stream transcoded audio (MP3) |
| `GET /info/<path>` | Get ffprobe metadata JSON for a file |
| `GET /playlist.m3u` | Full library M3U playlist |
| `GET /playlist/<folder>.m3u` | Per-folder M3U playlist |

## Discord / Lavalink Setup

See [docs/LAVALINK.md](docs/LAVALINK.md) for full integration details.

Quick start — use the transcode URL for any track:
```
https://your-domain.com/transcode/Artist/Album/track.m4a
```

## Project Structure

```
stellar-media/
├── fancyindex/
│   ├── header.html       # Page header, search bar, styles
│   ├── footer.html       # Audio player, track menu, JS logic
│   ├── logo.svg          # Stellar Media Library logo (source)
│   └── logo.png          # Stellar Media Library logo (deployed)
├── transcode/
│   ├── server.js         # Node.js transcode/info/playlist/OG server
│   ├── package.json      # Node package manifest
│   └── stellar-media.service  # systemd service unit
├── nginx/
│   └── default           # nginx site config
├── docs/
│   ├── CODEC_SUPPORT.md  # Supported formats reference
│   └── LAVALINK.md       # Discord/Lavalink integration guide
└── README.md
```

## License

MIT
