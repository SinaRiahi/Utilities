# 📑 PDF to Markdown Studio

A fast, private, browser-based PDF to Markdown converter with intelligent layout reconstruction, table extraction, mathematical formula formatting, image extraction, and real-time preview.

---

## ✨ Highlights

* 🔒 **100% Client-Side & Private**: All PDF processing, OCR analysis, layout reconstruction, and image extraction happen directly in your browser. No files or personal data are ever uploaded to an external server.
* 🧠 **Smart Layout & Geometry Engine**:
  * **Dynamic Heading Hierarchy**: Automatically determines Title, H1, H2, H3, and H4 based on font size statistics, weights, and spatial scaling.
  * **Multi-Column Column Flow**: Seamlessly handles 2-column and 3-column academic papers and magazines without interleaved line scrambling.
  * **De-Hyphenation & Paragraph Stitching**: Fixes split words across line breaks (e.g. `inter-` + `active` → `interactive`) and merges soft line breaks into continuous paragraphs.
  * **Header & Footer Stripping**: Detects and eliminates repetitive running headers, footers, and page numbers (`Page 1 of 10`).
* 📊 **Table & Math Extraction**:
  * Formats tabular data into clean GitHub-Flavored Markdown (GFM) tables (`| col1 | col2 |`).
  * Identifies mathematical symbols and wraps them in KaTeX/LaTeX format (`$inline$` and `$$display$$`).
  * Groups monospace font lines into fenced code blocks with language hints.
* 🖼️ **Image & Figure Extraction**:
  * Extracts embedded charts, graphics, and figures with original resolutions.
  * Embed as self-contained Base64 data URIs or relative asset folder paths.
  * Dedicated Image Gallery inspector with one-click copy, download, and markdown insertion.
* 👁️ **Triple-View Studio**:
  * **PDF Viewer**: High-DPI page rendering with zoom, rotation, page jumping, and structural X-Ray bounding box overlays.
  * **Markdown Editor**: Full editor with line numbers, search & replace, undo/redo, and live stats (words, characters, reading time).
  * **Live HTML Preview**: Real-time rendering with KaTeX math, GFM tables, syntax-highlighted code blocks, and copy buttons.
  * **Side-by-Side Diff**: Synchronized visual comparison of original PDF pages against converted Markdown.
* 📦 **Flexible Export & Suite Integration**:
  * Direct `.md` file download
  * Full `.zip` archive (Markdown + `images/` directory + metadata)
  * Standalone styled `.html` file export
  * One-click **"Open in MD Studio"** integration to immediately style, generate Mermaid diagrams, and export to PDF/DOCX!

---

## 🚀 Getting Started

1. **Load a PDF**: Drag and drop a PDF file into the drop zone, click **Open PDF**, or choose one of the built-in **Sample PDFs** (Technical Spec, Academic Paper, Financial Report, Meeting Notes).
2. **Select Preset or Adjust Options**: Choose an extraction preset (e.g., *Article*, *Technical*, *Academic*, *Tables*, *Raw*) or fine-tune heading thresholds, table extraction, and image handling in the Settings panel.
3. **Convert**: Click **⚡ Convert Document** to process all or selected pages.
4. **Inspect & Edit**: Review the extracted markdown in the editor or rendered preview, inspect extracted images in the gallery, or use X-Ray mode to check structural boundaries.
5. **Export or Send to MD Studio**: Download the `.md` file, export a complete `.zip` package, or click **🚀 Open in MD Studio** to further customize styling and export to PDF/DOCX.
