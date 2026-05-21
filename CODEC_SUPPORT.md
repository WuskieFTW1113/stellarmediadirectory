# Codec Support

## Browser-Native (no transcoding)
| Format | Codec | Notes |
|--------|-------|-------|
| MP3 | MPEG Layer 3 | Universal support |
| FLAC | Free Lossless | Lossless, Chrome/Firefox/Edge |
| OGG | Vorbis | Open source lossy |
| OPUS | Opus | Best quality/size ratio |
| WAV | PCM | Lossless, large files |

## Transcoded to MP3 on playback
| Format | Codec | Immersive Audio |
|--------|-------|----------------|
| M4A | AAC / EAC-3 | Dolby Atmos (EAC-3) |
| AAC | Advanced Audio Coding | Dolby Atmos (HE-AAC) |
| EAC-3 | Dolby Digital Plus | Dolby Atmos |
| AC-3 | Dolby Digital | Dolby Surround |
| TrueHD | Dolby TrueHD | Dolby Atmos, Lossless |
| DTS | DTS Coherent Acoustics | DTS:X |
| DTS-HD | DTS-HD Master Audio | DTS:X, Lossless |
| WMA | Windows Media Audio | — |
| AIFF / AIF | Audio Interchange | Lossless |
| ALAC | Apple Lossless | Lossless |

## Notes on Dolby Atmos
Atmos is detected from actual stream metadata via ffprobe, not just file extension.
A plain AAC M4A will not show the Atmos badge — only files with EAC-3 or
flagged Atmos metadata will.

## Discord / Lavalink
Discord is stereo-only. All formats are transcoded to 320kbps MP3 stereo
using an ITU-R BS.775 downmix filter for best surround-to-stereo quality.
