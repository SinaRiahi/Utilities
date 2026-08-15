# Image Converter

A fully serverless, browser-based image conversion utility with batch processing and folder recursion. Convert images between all major formats, including specialized icon formats like ICO and ICNS, directly in a browser.

![ImgConverter Screenshot](images/imgconverter.png)

## ✨ Features

### 🎯 Comprehensive Format Support
- **Icon Formats:** ICO (Windows), ICNS (macOS) with multi-size support
- **Raster Images:** PNG, JPEG, WebP, GIF, BMP, TIFF
- **Document/Vector:** PDF (embedded image), SVG (wrapped raster)

### 📐 Advanced ICO Configuration
- Select any combination of sizes: 16×16, 24×24, 32×32, 48×48, 64×64, 128×128, 256×256
- Uses modern PNG-compressed ICO entries for optimal file size
- Perfect for favicons, app icons, and Windows executables

### 📁 Batch & Folder Processing
- **Single files** via file picker or drag-and-drop
- **Entire folders** with recursive subfolder traversal
- Optional preservation of folder structure in ZIP downloads
- Drag-and-drop folder support from your file manager
- Visual file queue with individual status tracking

### 🔒 Privacy & Security
- **100% client-side:** All processing happens in your browser
- **No server uploads:** Files never leave your computer
- **No telemetry, no tracking, no analytics**
- Works offline after initial page load
