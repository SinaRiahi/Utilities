# YouTube Downloader

A high-performance YouTube video and audio downloader module for the Utilities suite.

## Features

- **Multi-Resolution Video Downloads**: Extract and download video in crystal-clear MP4 with muxed audio at resolutions up to 4K (2160p), 1440p (2K), 1080p Full HD, 720p HD, 480p, 360p, and 240p.
- **Dedicated MP3 Audio Extraction**: Convert YouTube video soundtracks directly to MP3 with presets for 320 kbps (Studio Quality), 192 kbps (Standard HQ), and 128 kbps (Compact/Voice). Automatically embeds ID3 title and artist metadata tags.
- **Original Audio Streams**: Direct loss-less downloads for original M4A (AAC) and WebM (Opus) streams.
- **Smart URL Parsing**: Recognizes standard YouTube links (`watch?v=...`), short links (`youtu.be/...`), YouTube Shorts (`shorts/...`), embed links (`embed/...`), and YouTube Music.
- **Automatic Stream Deciphering**: Built with modern InnerTube decryption that extracts both video and audio streams seamlessly.
- **FFmpeg Stream Acceleration**: High-speed muxing and audio transcoding using native FFmpeg with faststart headers.
- **Cookie Authentication Support**: Optional session cookie manager to unlock age-restricted or private content when challenged with bot-verification.
- **Light & Dark Mode**: Seamlessly synchronized with the Utilities suite theme engine.

## Usage

1. Open **YouTube Downloader** from the Utilities home page or navigate to `/YouTube_Downloader/`.
2. Paste any YouTube URL or click one of the quick sample chips.
3. Click **Analyze Video** to retrieve available resolutions and audio formats.
4. Select your preferred format:
   - Under **Video (MP4)**, choose your desired resolution (e.g. 1080p, 720p).
   - Under **Audio Only (MP3)**, choose your preferred bitrate (e.g. 320kbps, 192kbps).
5. Click **Download** to start the download directly to your browser.
