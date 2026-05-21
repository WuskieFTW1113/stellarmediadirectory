const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const url = require('url');

const MUSIC_ROOT = '/path/to/your/music';
const PORT = 3000;
const BITRATE = 320000;
const BASE_URL = 'https://your-domain.com';
const TRANSCODE_EXTS = new Set(['m4a','aac','wma','aiff','alac','eac3','ac3','truehd','dts','dtshd']);
const AUDIO_EXTS = new Set(['mp3','flac','ogg','wav','opus','m4a','aac','wma','aiff','alac','eac3','ac3','truehd','dts','dtshd']);

// Simple in-memory cache so we don't ffprobe the same file twice
const infoCache = new Map();

function probeFile(filePath) {
  if (infoCache.has(filePath)) return infoCache.get(filePath);
  try {
    const raw = execSync(
      `ffprobe -v error -show_streams -show_format -of json "${filePath}"`,
      { timeout: 8000 }
    ).toString();
    const data = JSON.parse(raw);
    const audioStream = (data.streams || []).find(s => s.codec_type === 'audio');
    const format = data.format || {};
    const tags = { ...(format.tags || {}), ...(audioStream ? (audioStream.tags || {}) : {}) };

    // Normalize tag keys to lowercase
    const normTags = {};
    for (const k of Object.keys(tags)) normTags[k.toLowerCase()] = tags[k];

    const codec = audioStream ? audioStream.codec_name : null;
    const profile = audioStream ? (audioStream.profile || '') : '';
    const channelLayout = audioStream ? (audioStream.channel_layout || '') : '';
    const channels = audioStream ? (audioStream.channels || 0) : 0;
    const duration = parseFloat(format.duration || 0);

    // Detect immersive/spatial formats from codec + profile
    const isAtmos = codec === 'eac3' || codec === 'ac3' ||
      (codec === 'aac' && (profile.toLowerCase().includes('he') || channelLayout.includes('7'))) ||
      profile.toLowerCase().includes('atmos') ||
      (normTags['comment'] || '').toLowerCase().includes('atmos') ||
      (normTags['description'] || '').toLowerCase().includes('atmos');

    const isDTS = codec === 'dts';
    const isDTSX = isDTS && (profile.toLowerCase().includes('dts:x') || channels > 6);
    const isTrueHD = codec === 'truehd';
    const isLossless = ['flac','alac','pcm_s16le','pcm_s24le','pcm_s32le','truehd'].includes(codec);
    const isSurround = channels > 2;

    const result = {
      codec,
      profile,
      channels,
      channelLayout,
      duration,
      isAtmos,
      isDTS,
      isDTSX,
      isTrueHD,
      isLossless,
      isSurround,
      title: normTags['title'] || null,
      artist: normTags['artist'] || normTags['album_artist'] || null,
      album: normTags['album'] || null,
    };

    infoCache.set(filePath, result);
    return result;
  } catch (e) {
    console.error('ffprobe error:', e.message);
    return null;
  }
}

function getDuration(filePath) {
  const info = probeFile(filePath);
  return info ? info.duration : null;
}

function walkDir(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walkDir(full));
    else if (entry.isFile()) {
      const ext = entry.name.split('.').pop().toLowerCase();
      if (AUDIO_EXTS.has(ext)) files.push(full);
    }
  }
  return files;
}

function buildM3U(dir) {
  const files = walkDir(dir);
  let m3u = '#EXTM3U\n';
  for (const f of files) {
    const name = path.basename(f, path.extname(f));
    const ext = f.split('.').pop().toLowerCase();
    const relative = f.slice(MUSIC_ROOT.length);
    const encoded = relative.split('/').map(p => encodeURIComponent(p)).join('/');
    const fileUrl = TRANSCODE_EXTS.has(ext)
      ? `${BASE_URL}/transcode${encoded}`
      : `${BASE_URL}/Music/Music${encoded}`;
    m3u += `#EXTINF:-1,${name}\n${fileUrl}\n`;
  }
  return m3u;
}

function ogEmbed(title, desc) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="Stellar Media Library">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${BASE_URL}/fancyindex/logo.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="theme-color" content="#c778dd">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${BASE_URL}/fancyindex/logo.png">
</head>
<body></body>
</html>`;
}

http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = ua.includes('discordbot') || ua.includes('twitterbot') || ua.includes('facebookexternalhit');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,HEAD' });
    res.end(); return;
  }

  // Logo
  if (pathname === '/fancyindex/logo.png') {
    const logoPath = '/var/www/html/fancyindex/logo.png';
    if (fs.existsSync(logoPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(logoPath).pipe(res);
    } else { res.writeHead(404); res.end('Logo not found'); }
    return;
  }

  // /info/ endpoint — returns JSON codec metadata for a file
  if (pathname.startsWith('/info/')) {
    const relativePath = pathname.slice('/info/'.length);
    const filePath = path.join(MUSIC_ROOT, relativePath);
    if (!filePath.startsWith(MUSIC_ROOT) || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Not found' })); return;
    }
    const info = probeFile(filePath);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' });
    res.end(JSON.stringify(info || { error: 'probe failed' }));
    return;
  }

  // OG embed for Discord
  if (isBot && pathname.startsWith('/transcode/')) {
    const relativePath = pathname.slice('/transcode/'.length);
    const filePath = path.join(MUSIC_ROOT, relativePath);
    if (!filePath.startsWith(MUSIC_ROOT) || !fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const parts = relativePath.split('/');
    const filename = parts[parts.length - 1].replace(/\.[^.]+$/, '');
    const folder = parts.length > 1 ? parts[parts.length - 2] : 'Stellar Media Library';
    const info = probeFile(filePath);
    const title = (info && info.title) || filename;
    const artist = (info && info.artist) ? info.artist + ' · ' : '';
    const tags = [];
    if (info) {
      if (info.isAtmos) tags.push('Dolby Atmos');
      if (info.isDTSX) tags.push('DTS:X');
      else if (info.isDTS) tags.push('DTS');
      if (info.isTrueHD) tags.push('TrueHD');
      if (info.isLossless) tags.push('Lossless');
      if (info.isSurround) tags.push(info.channels + 'ch Surround');
    }
    const desc = artist + folder + ' · Stellar Media Library' + (tags.length ? ' · ' + tags.join(' · ') : '');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(ogEmbed(title, desc));
    return;
  }

  // Transcode endpoint
  if (pathname.startsWith('/transcode/')) {
    const relativePath = pathname.slice('/transcode/'.length);
    const filePath = path.join(MUSIC_ROOT, relativePath);
    if (!filePath.startsWith(MUSIC_ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('File not found'); return; }

    const duration = getDuration(filePath);
    const headers = {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Duration': duration ? duration.toString() : '0',
    };
    if (duration) headers['Content-Length'] = Math.ceil((BITRATE / 8) * duration).toString();

    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }

    const ff = spawn('ffmpeg', [
      '-i', filePath, '-vn', '-acodec', 'libmp3lame',
      '-ab', '320k', '-f', 'mp3', '-loglevel', 'error', 'pipe:1'
    ]);
    ff.stdout.pipe(res);
    ff.stderr.on('data', d => console.error(d.toString()));
    req.on('close', () => ff.kill('SIGKILL'));
    ff.on('close', () => res.end());
    return;
  }

  // M3U playlist
  if (pathname === '/playlist.m3u' || pathname.startsWith('/playlist/')) {
    const subPath = pathname === '/playlist.m3u'
      ? MUSIC_ROOT
      : path.join(MUSIC_ROOT, pathname.slice('/playlist/'.length).replace(/\.m3u$/, ''));
    if (!subPath.startsWith(MUSIC_ROOT) || !fs.existsSync(subPath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const m3u = buildM3U(subPath);
    res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl', 'Access-Control-Allow-Origin': '*' });
    res.end(m3u);
    return;
  }

  res.writeHead(404); res.end('Not found');

}).listen(PORT, () => console.log(`Transcode server running on :${PORT}`));
