# Lavalink / Discord Bot Integration

## Direct Playback
For MP3, FLAC, OGG, WAV — use the direct URL:
```
https://your-domain.com/Music/Music/Artist/Album/track.mp3
```

## Transcoded Playback (M4A, Atmos, DTS, etc.)
For formats Discord/Lavalink can't decode natively, use the transcode endpoint:
```
https://your-domain.com/transcode/Artist/Album/track.m4a
```
Returns a 320kbps MP3 stream with proper `Content-Length` for seeking.

## M3U Playlists
Load an entire folder as a playlist — all incompatible formats are
automatically pre-routed to `/transcode/`:

```
# Full library
https://your-domain.com/playlist.m3u

# Specific album folder
https://your-domain.com/playlist/Artist/Album.m3u
```

## Discord Embeds
When a `/transcode/` URL is shared in Discord, the Discordbot crawler
receives an Open Graph embed showing:
- **Site name:** Stellar Media Library
- **Title:** Track name (from metadata)
- **Description:** Artist · Album · format tags (Dolby Atmos, DTS:X, etc.)
- **Thumbnail:** Stellar Media Library logo
- **Theme color:** #c778dd

Regular browsers and Lavalink hitting the same URL receive the audio stream.
