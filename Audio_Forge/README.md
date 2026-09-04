# Audio Forge

A fully serverless, browser-based audio editor and format conversion utility with visual waveform editing, batch processing, audio effects, and multi-format conversion. Edit and convert music and audio files directly in your browser.

## ✨ Features

### 🎯 Comprehensive Format & Codec Conversion
- **Lossless PCM Audio:** WAV 16-bit PCM (CD quality), WAV 24-bit Studio, WAV 32-bit Float
- **Compressed Audio:** MP3 (with custom bitrates from 64 kbps to 320 kbps High Fidelity)
- **Web & Streaming Audio:** WebM Opus, OGG Opus
- **Ringtone & Alert Clips:** Apple M4R / MP3 formatted clips
- **Flexible Sample Rates:** 8 kHz, 16 kHz, 22.05 kHz, 32 kHz, 44.1 kHz, 48 kHz, or original rate

### 🏷️ Song Metadata & Album Cover (ID3) Editor
- **Custom Track Information:** Modify Track Title, Artist, Album, Year, Genre, and Track Number
- **Embed Cover Artwork:** Upload custom JPEG/PNG/WebP album covers and embed directly into MP3 exports
- **Client-Side ID3v2 Tags:** Powered by `browser-id3-writer` with zero server uploads

### ✂️ Precision Waveform & Region Editing
- **Interactive Dual-Channel Waveform:** Smooth amplitude rendering with zoom controls (1x to 8x)
- **Time Ruler & In/Out Markers:** Draggable selection region with millisecond accuracy
- **Non-Destructive Trimming & Cutting:** Trim to region or cut unwanted sections with one click
- **Undo / Redo Stack:** Full undo history for edits
- **Real-Time Playhead & Seeking:** 60fps playhead syncing with Web Audio API playback

### 🎚️ 3-Band EQ, Dynamics & Filters
- **Volume Normalization:** One-click 0 dB peak normalize, -1 dB safe normalize, or custom gain (-24 dB to +24 dB)
- **Equalizer:** Low shelf (100 Hz), Peaking Mid (1,000 Hz), High shelf (8,000 Hz) with presets (Bass Boost, Vocal Air, Podcast Clean, Lo-Fi)
- **Rumble & Hiss Filters:** High-Pass Filter (cut low hum) & Low-Pass Filter (cut harsh highs)
- **Fades & Phase:** Custom fade-in (0–10s) and fade-out (0–10s) envelopes, waveform phase inversion

### 🚀 Creative Effects & Sound Design
- **Speed & Tempo Control:** 0.25x to 3.0x time stretching
- **Reverse Audio:** Play and export tracks backwards
- **Channel Operations:** Stereo, Mono downmix, Left/Right channel solo, Center vocal remover (phase cancellation), Left/Right swap
- **Effects & Ambience:** Reverb room mix, Echo delay, Tube overdrive saturation
- **Silence Trimmer:** Strip leading and trailing silence automatically

### 🎙️ Live Microphone Recording & Synth Generator
- **Built-in Mic Recorder:** Record audio directly from any input device with live audio oscilloscope
- **Synthesizer Tone Generator:** Generate pure sine, triangle, square, sawtooth tones or white noise for acoustic calibration

### 📁 Batch Processing & ZIP Export
- **Multiple Files:** Drag and drop batches of audio files
- **ZIP Bundle Download:** Convert entire queues and download as a single ZIP archive

### 🔒 Privacy & GitHub Pages Compatible
- **100% Client-Side:** Web Audio API and pure JavaScript encoders — no audio files are uploaded to any server
- **Works Offline:** Full compatibility with GitHub Pages static hosting
