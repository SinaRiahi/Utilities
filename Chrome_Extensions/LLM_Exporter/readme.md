# Universal LLM Exporter

A lightweight Chrome extension for extracting messages from AI conversations and exporting them as clean Markdown or PDF.

Instead of manually copying AI responses one by one, Universal LLM Exporter lets you open the extension while viewing a conversation, select the messages you want, and copy them all at once.

> **Current version:** `0.3.9`

---

## Features

### 🧠 Real-time In-Memory Message Recording
The extension includes a real-time message recorder that actively captures completed AI responses in memory and local storage as they finish:
* **Solves DOM Virtualization:** Long chats on platforms like ChatGPT and DeepSeek unload earlier conversation sections as you scroll, causing missing turns or duplicates. The in-memory recorder preserves every finished response across the entire session.
* **One-Click Export:** When you open the extension, all captured AI turns are already selected and ready to copy with a single click.
* **Toolbar Controls:** Easily toggle between **All**, **AI only**, **None**, or **Clear memory** for the current chat session.

### 📋 Select and copy messages

The extension detects messages in the currently open AI conversation and displays them in a compact list.

Each message can be individually selected or deselected.

* Select individual messages
* Select all messages or AI only
* Deselect all messages
* Clear recorded memory per conversation
* Refresh the conversation
* See a short preview of each message
* AI responses are selected by default
* **Auto Continue:** Repeatedly send prompts with robust multi-platform generation detection (including DeepSeek thinking and completion tracking).

The selected messages are copied as **Markdown**, making them ready to paste directly into a Markdown editor.

### 📄 Direct PDF export

Selected messages can also be exported directly as a PDF.

This means you can either:

**Markdown workflow**

```text
AI conversation
      ↓
Universal LLM Exporter
      ↓
Select messages
      ↓
Copy Markdown
      ↓
Markdown editor
      ↓
PDF
```

or skip the editor:

```text
AI conversation
      ↓
Universal LLM Exporter
      ↓
Select messages
      ↓
PDF
```

### 🌐 Multi-platform support

The extension is designed to work with several major AI platforms:

* ChatGPT
* Claude
* DeepSeek
* Gemini
* Grok

The extension uses platform-specific extraction logic because each AI website structures its conversation differently.

---

## Why this exists

Saving useful AI conversations usually involves a surprisingly repetitive process:

> Find response → select text → copy → paste → repeat

This becomes especially annoying when a conversation contains many long responses.

Universal LLM Exporter reduces the process to:

> Open extension → select what you want → copy

The goal is not to turn every conversation into a giant export automatically. Instead, it gives you **precise control over which messages become part of the final document**.

---


## Installation

This extension is currently intended to be installed as an unpacked Chrome extension.

### 1. Download or clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/universal-llm-exporter.git
```

Or download the repository as a ZIP.

### 2. Open Chrome extensions

Navigate to:

```text
chrome://extensions
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

### 4. Load the extension

Click:

```text
Load unpacked
```

Select the directory containing:

```text
manifest.json
```

For example:

```text
extension/
├── manifest.json
├── background/
├── content/
├── offscreen/
├── popup/
├── shared/
└── assets/
```

### 5. Open a supported AI conversation

Navigate to a conversation on one of the supported platforms.

Click the Universal LLM Exporter icon in Chrome's toolbar.

---

## Usage

### Copy selected messages

1. Open an AI conversation.
2. Click the extension icon.
3. Wait for the messages to be detected.
4. AI responses will be selected automatically.
5. Select or deselect individual messages as needed.
6. Click **Copy selected Markdown**.
7. Paste the result into your Markdown editor.

The copied content contains the actual Markdown from the selected messages.

No additional labels such as:

```text
AI:
User:
```

are inserted into the copied document.

This makes the output suitable for directly pasting into an existing Markdown document.

---

## PDF export

If you don't need to edit the Markdown first:

1. Select the messages you want.
2. Click **Export selected as PDF**.
3. The extension generates the PDF from the selected messages.

Only the selected messages are included.

---

## Supported message content

The exporter is designed to preserve Markdown-based content such as:

* Headings
* Paragraphs
* Lists
* Ordered lists
* Code blocks
* Inline code
* Links
* Tables
* Blockquotes
* Mathematical content
* Mermaid diagrams where supported by the renderer

The exact rendering depends on the source platform and the content it exposes to the browser.

---

## Architecture

Universal LLM Exporter is a Chrome Manifest V3 extension.

```text
                    ┌─────────────────────┐
                    │    AI Conversation  │
                    │ ChatGPT / Claude /  │
                    │ DeepSeek / Gemini / │
                    │ Grok                │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Content Script    │
                    │                     │
                    │ Platform-specific   │
                    │ message extraction  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Popup UI         │
                    │                     │
                    │ Message selection   │
                    │ Select all / none   │
                    └───────┬─────┬───────┘
                            │     │
                 Markdown   │     │ PDF
                   copy     │     │ export
                            ▼     ▼
                       Clipboard  │
                                  ▼
                         ┌────────────────┐
                         │ PDF Renderer   │
                         └───────┬────────┘
                                 │
                                 ▼
                              PDF file
```

### Main components

#### `content/`

Contains the platform-specific extraction logic.

Each supported AI service has its own extraction strategy because their DOM structures differ.

#### `popup/`

Contains the compact message-selection interface.

The popup is responsible for:

* Displaying detected messages
* Managing selection
* Copying Markdown
* Starting PDF exports

#### `background/`

Contains the Manifest V3 service worker.

It coordinates exports and communication with the offscreen renderer.

#### `offscreen/`

Handles rendering operations that require a document context unavailable directly inside the service worker.

#### `shared/`

Contains reusable utilities shared by the different extension components.

#### `assets/`

Contains extension assets such as the toolbar icon.

---

## DeepSeek support

DeepSeek requires its own extraction and auto-prompting logic because its conversation DOM and streaming states differ significantly from other supported platforms:

* **Thinking Isolation:** Reasoning blocks (`.ds-think-content`) are extracted separately and strictly excluded from the final assistant answer Markdown.
* **Accurate Completion Detection:** The extension monitors thinking spinners, text state changes, streaming cursors, the presence of active stop buttons/icons, and the mounting of the completion action bar (Copy/Regenerate buttons) alongside a 2400ms stabilization window. This prevents premature auto-prompt interruption while DeepSeek is still reasoning or formulating its response.
* **Dynamic Classes:** Resilient selectors accommodate DeepSeek's frequent CSS updates.

---

## Privacy

Universal LLM Exporter is designed to process conversations **locally in the browser**.

The extension does not need to send conversation content to an external server to perform extraction or Markdown copying.

Your conversation remains on the AI website and inside your browser.

No account or external backend is required.

> Always review the extension permissions and source code yourself before installing any browser extension.

---

## Limitations

### Currently rendered messages

The extension extracts messages that are available in the conversation's current page/DOM.

If a platform uses lazy-loading or virtualization, very old messages may not be present in the DOM yet.

The exporter does not currently guarantee automatic traversal of an arbitrarily long conversation history.

### Website changes

AI platforms frequently change their frontend code.

A change to the DOM structure of ChatGPT, Claude, DeepSeek, Gemini, or Grok may temporarily break extraction for that platform.

Platform-specific extractors are therefore intentionally separated so they can be updated independently.

### Browser support

The project targets Chromium-based browsers supporting Manifest V3.

Chrome is the primary target.

---


## Development

### Requirements

* Node.js
* npm
* Chromium-based browser
* Chrome Developer Mode

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

The resulting extension can then be loaded through:

```text
chrome://extensions
```

using **Load unpacked**.



---

## Related project

Universal LLM Exporter works particularly well with **Markdown Studio**, a browser-based Markdown editor and PDF workflow:

**Markdown Studio:**
https://sinariahi.github.io/Utilities/MD_Studio/

A typical workflow is:

```text
AI conversation
      ↓
Universal LLM Exporter
      ↓
Copy selected Markdown
      ↓
Markdown Studio
      ↓
Edit / organize / format
      ↓
Export PDF
```

---


Built as a practical utility for turning useful AI conversations into organized, editable documents without manually copying every response.
