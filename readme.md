# 🛠 Utilities

> **A growing collection of tools built to solve everyday problems.**

<!-- <p align="center">
  <img src="screenshots/home.png" alt="Utilities Home" width="900">
</p> -->

Utilities is my personal toolbox.

Instead of relying on dozens of different websites for small tasks, I decided to build my own collection of utilities in one place. Every tool in this repository exists because I personally needed it, wanted to learn something new, or thought:

> *"There has to be a better way to do this."*

While this project started as a learning experience, its goal is much bigger:

**Create a fast, clean, and practical collection of utilities that anyone can use.**

---

# ✨ Philosophy

Every utility in this repository follows a few simple principles.

* ⚡ Fast and responsive
* 🎯 Solve one problem well
* 🧩 Simple to use
* 🚫 No unnecessary clutter
* 🔒 Privacy-friendly whenever possible
* 📈 Built to improve over time

Rather than creating dozens of half-finished tools, I'd rather build a smaller collection of utilities that are genuinely useful.

---

# 📸 Preview

## Home Page

<p align="center">
  <img src="images/home.png" width="900">
</p>

---

## MD Studio

<p align="center">
  <img src="images/MD_Studio.png" width="900">
</p>

---

# 📦 Current Utilities

## 📝 MD Studio
> A modern Markdown editor focused on creating beautiful documents.

* ✍️ Live Markdown editor & real-time preview
* 📄 Export to PDF, HTML, and DOCX
* 🧮 KaTeX math & 📊 Mermaid diagram support
* 🎨 Syntax highlighting & automatic Table of Contents
* 🌙 Light & Dark mode

---

## 📑 PDF to Markdown
> Fast, privacy-friendly in-browser PDF to Markdown conversion with smart layout analysis.

* 🧠 **Smart Layout & Hierarchy Detection**:
  * Dynamic heading detection (H1–H6) based on font metrics, weights, and spatial scaling
  * Multi-column text flow ordering (prevents interleaved column text in academic papers)
  * Smart paragraph stitching and automatic de-hyphenation across line wraps
  * Strips recurring running headers, footers, and page numbers
* 📊 **Table & Math Extraction**:
  * Converts structured data into clean GitHub-Flavored Markdown (GFM) tables
  * Recognizes mathematical notation and formats into KaTeX / LaTeX `$math$` and `$$equation$$`
  * Preserves monospace blocks as fenced code snippets with language hints
* 🖼️ **Image & Figure Extraction**:
  * Extracts embedded images, charts, and diagrams with high fidelity
  * Option to embed as inline Base64 data URIs or export as linked image assets
  * Image gallery inspector with resolution preview and individual downloads
* 👁️ **Interactive Dual/Triple View Studio**:
  * High-resolution PDF page viewer with zoom, rotation, page navigation, and X-Ray structural bounding box overlays
  * Live Markdown editor with line numbers, search & replace, and real-time formatted HTML preview
  * Side-by-side visual comparison between original PDF pages and generated Markdown
* 📦 **Flexible Export & Suite Integration**:
  * Export as `.md`, `.txt`, `.html`, or full `.zip` bundle (Markdown + images + metadata)
  * One-click "Open in MD Studio" for instant styling, Mermaid diagramming, and PDF/DOCX rendering
  * 100% client-side, offline-capable, and private (no files sent to external servers)

---

## 🖼️ Image Forge
> Professional in-browser image editor, batch converter, and enhancement studio.

* 🔄 Convert between PNG, JPEG, WEBP, GIF, BMP, ICO, ICNS, SVG, and PDF
* 📐 Resize, smart crop, aspect fit/fill/contain, and dimension limits
* 🖋️ **Adobe Illustrator "Black and White Logo" Vector & Threshold Mode**:
  * Precision Rec.709 luminance thresholding with 0–255 parametric sensitivity
  * Despeckle / Noise reduction filter removing stray raster artifacts
  * Sub-pixel boundary smoothing to eliminate stair-stepping without blurring
  * "Ignore White" option for automatic transparent background generation
  * Direct vector tracing into pure SVG `<path>` elements without raster bloat
* 🎨 **Creative Effects & Filtering**:
  * Parametric Sharpening (Laplacian 3x3 convolution)
  * Radial Vignette with adjustable falloff curves
  * Posterization tone-reduction (2–16 steps)
  * Pixelate mosaic generator (2–32 px block size)
  * Emboss & Sobel 3x3 Edge Detection filters
  * Color grading presets (Vivid, Warm Golden, Cool Film, Noir B&W, Sepia, Cyberpunk, Invert)
* 🪄 Instant in-browser background removal (transparent alpha masking)
* 🔍 EXIF & Image Metadata inspector with privacy stripping on export
* ⚖️ Side-by-side & Interactive split-slider comparison with real-time effect preview
* 🌈 Auto-extracted dominant 7-color HEX palette with one-click copy
* 🔒 100% client-side processing (no server uploads)

---

## 🎵 Audio Forge
> Professional in-browser audio editor, waveform trimmer, and music converter.

* 🔄 Convert between MP3 (64–320 kbps), WAV (16-bit PCM, 24-bit studio, 32-bit float), WebM, and OGG Opus
* 🏷️ ID3 Tag & Song Metadata Editor: Title, Artist, Album, Year, Genre, Track #, and Album Cover art embedding
* ✂️ Visual dual-channel waveform editor with precision trimming, region cutting, and zoom (1x to 8x)
* 🎚️ 3-Band Equalizer (Bass, Mid, Treble) & Low-Pass / High-Pass filters with audio presets
* ⚡ Peak & safe volume normalization (-24 dB to +24 dB gain) with fade-in and fade-out
* 🚀 Tempo/speed stretching (0.25x - 3.0x), reverse audio playback, and center vocal remover
* 🎙️ Live microphone recording with oscilloscope & synthesizer tone generator
* 📦 Batch audio conversion with one-click ZIP bundle export
* 🔒 100% private client-side processing (GitHub Pages ready)

---

## 🗂️ File Forge
> Batch file renaming, organization, and asset manager.

* 🏷️ Batch rename with prefixes, suffixes, and regex
* 🔢 Auto-numbering and case transformations
* 📦 Package and download processed files into a ZIP archive

---

## 📲 File Transfer
> Fast, private PC ↔ Mobile peer-to-peer file transfer.

* 🌐 **GitHub Pages Ready**: Powered by WebRTC DataChannels with zero cloud storage
* 📷 Scan QR code to pair phone and PC instantly
* ⚡ Direct chunked streaming with real-time transfer progress
* 🔒 End-to-end private transfer

---

## 🔍 WebScope
> Website intelligence and reconnaissance for AI agents and developers.

* 📡 Inspect website assets, scripts, and endpoints
* 🔎 Correlate known variables with network responses
* 📦 Package evidence bundles directly into downloadable ZIPs

---

## 🎯 AutoScope — Automation & Site Intelligence (Chrome Extension v2.0)
> Advanced in-browser automation inspector and reconnaissance studio for Playwright, Puppeteer, Selenium, and Python bots.

* 🧠 **Deep Site & Environmental Intelligence**:
  * SPA framework & architecture detection (React, Next.js, Vue, Nuxt, Angular, Svelte, jQuery, Tailwind, Bootstrap)
  * iFrame & cross-origin boundary mapping with `page.frameLocator(...)` snippets
  * Modal, dialog, and popover state tracking (`[aria-modal="true"]`, `<dialog>`)
  * Live viewport metrics, device pixel ratio, document dimensions, and storage counters
* 🎯 **Multi-Strategy Resilient Selectors**:
  * Prioritizes Playwright best practices: `page.getByTestId()`, `page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`, `page.getByText()`
  * Unique verified CSS paths evaluated against DOM uniqueness
  * Semantic XPaths (`//button[normalize-space()='...']`, `//input[@name='...']`)
  * Code-ready action snippets: `await page.click()`, `await page.fill()`, `await page.check()`
* 🖥️ **Interactive In-Page Automation HUD & Live Inspector**:
  * Non-intrusive floating dock with Inspector, Insights, and Quick Export panes
  * Real-time element highlight box with live dimension badge (`width × height px`)
  * Quick 1-click clipboard copy for Playwright, CSS, XPath, and Python snippets
  * Keyboard shortcut: `Esc` to toggle live inspector on and off
* 📦 **Comprehensive Export Formats**:
  * **Automation Dossier (`.md`)**: Full structural Markdown report with tables, action guides, and frame warnings
  * **Automation Spec (`.json`)**: Machine-readable schema for AI coding agents and automated scrapers
  * **Playwright Test Scaffolding (`.spec.ts`)**: Runnable test script ready for `npx playwright test`
  * **Python Playwright Script (`automate.py`)**: Synchronous script template ready to execute

---

# 🚀 Planned Utilities

Utilities is designed to grow over time.

Some ideas currently on my roadmap include:

* 🖼 Image utilities
* 📋 JSON formatter
* 📦 File conversion tools

...and many more as I encounter new problems worth solving.

---

# 🛠 Tech Stack

<p align="center">
<img src="https://skillicons.dev/icons?i=html,css,ts,python,fastapi,docker,git,github,vscode&perline=9"/>
</p>

The technologies behind Utilities will continue evolving as I explore new frameworks and ideas.

---

# ❤️ Why I'm Building This

This project exists because I enjoy building software that I actually use.

Every new utility begins with the same question:

> **Would I personally use this every week?**

If the answer is yes, it deserves a place in this collection.

Some utilities might only save a few seconds.

Others might save hours.

Either way, they're worth building.

---

# 🌱 Learning Through Building

Utilities also serves as my learning playground.

Whenever I learn a new technology, framework, or concept, I try to apply it to a real project instead of leaving it as another completed tutorial.

Every utility teaches me something new.

Every commit represents progress.

---

# 🤝 Contributions

Ideas, suggestions, bug reports, and pull requests are always welcome.

If there's a utility you think would be useful, feel free to open an issue.

---

# ⭐ Support

If you find this project useful, consider giving it a star.

It helps others discover the project and motivates me to keep building new utilities.

---

# 📜 License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

<p align="center">

## Build. Learn. Improve. Repeat.

For those who come after...

</p>
