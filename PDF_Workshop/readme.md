# 📑 PDF Workshop

> **High-performance in-browser PDF splitting, compression, and AI digestion studio designed for Google Gemini LM, NotebookLM, Claude, and multimodal LLMs.**

---

## 🚀 Key Features

* ⚡ **Intelligent Chunking Engine**:
  * **Page-Count Slicing (Every N Pages)**: Split documents evenly into 5, 10, 20, or 50-page sections.
  * **Boundary Overlap (1–2 Pages)**: Prevents cross-page context loss for LLMs.
  * **AI Token Budget Splitter**: Groups pages based on dynamic character/token density targets (~25k to ~200k tokens).
  * **Custom Page Ranges**: Flexible syntax parser (e.g. `1-5, 6-12, 13-end`).
  * **TOC / Chapter Splitting**: Extracts embedded bookmarks and splits by chapter.
  * **Single Page Burst**: Burst all pages into standalone files or selective page export.

* 🤖 **Gemini LM Optimization Suite**:
  * **Prompt Guide & Manifest**: Bundles a ready-to-copy `GEMINI_PROMPT_GUIDE.md` and `manifest.json` mapping all parts, page ranges, and summaries.
  * **Context Metadata Stamping**: Injects `[Part X of Y]` and title tags into PDF headers.
  * **Blank Page Stripper**: Detects and removes blank separator pages.
  * **Companion Text Extraction**: Exports clean markdown/text files alongside each PDF chunk.

* 🗜️ **Compression & Performance**:
  * Object stream optimization and unreferenced object cleanup via PDF-Lib.
  * 100% client-side execution with zero external uploads (complete privacy).

---

## 🛠️ Tech Stack

* **PDF-Lib**: Fast client-side PDF manipulation, copying, and metadata injection.
* **PDF.js**: Page rendering, text extraction, token estimation, and outline parsing.
* **JSZip**: Archive creation for multi-part PDF bundles.
