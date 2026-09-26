# 🎙️ Persian Speech to Text — تایپ صوتی و استودیو گفتار فارسی

> **استودیو تبدیل بلادرنگ گفتار به متن و متن به گفتار فارسی (100% Client-Side & Zero Voice Recording)**

Persian Speech to Text is a high-performance Persian (Farsi) voice studio. It features a **prominent Big Microphone button** to start continuous real-time voice typing directly into the text editor as you speak.

---

## ✨ Features

### 🎙️ Speech-to-Text (تبدیل گفتار به متن - Main Feature)
* **Big Microphone Button**: Click the large centered microphone button to start or stop listening instantly.
* **Continuous Real-Time Writing**: As you talk in Persian, your spoken words are streamed and typed directly into the text box with zero delay.
* **Zero Audio Recording**: **No audio is recorded or stored** to disk or server. Audio waves are processed purely in real-time in your browser's memory and converted on the fly.
* **No API Keys or Cloud AI Required**: 100% free, unlimited, and private using the browser's native Web Speech API (`fa-IR` and `fa-AF`).
* **Live Frequency Waveform Monitor**: Real-time canvas visualizer shows microphone activity using the Web Audio API.
* **Persian Typography Engine**:
  * ✍️ **Nim-Fasele (نیم‌فاصله)**: Automatically normalizes standard Persian half-spaces (`می‌شود`, `کتاب‌ها`, `خانه‌اش`).
  * 🔢 **Persian Digits**: Instant bidirectional conversion between Latin (`123`) and Persian digits (`۱۲۳`).
  * 🖋️ **Persian Punctuation**: Corrects commas (`،`), question marks (`؟`), semicolons (`؛`), and Persian quotation marks (`«»`).
  * 🧹 **Whitespace Cleaner**: Removes double spaces, redundant linebreaks, and trailing artifacts.
* **Multi-Format Document Export**:
  * 📝 **Download as Word Document (`.doc`)**: Fully styled RTL Persian document ready for Microsoft Word and Google Docs.
  * 📄 **Download as Markdown (`.md`)**
  * 💾 **Download as Plain Text (`.txt`)**
  * 📋 1-Click Copy to clipboard

### 🔊 Text-to-Speech (تبدیل متن به گفتار - TTS)
* **Local Browser Voice Synthesis**: Speaks Persian text with native system voices (`window.speechSynthesis`).
* **Playback Controls**: Play, Pause, Resume, and Stop with zero latency.
* **Voice Parameters**: Speed (0.5x to 2.0x), Pitch (0.5 to 1.5), and Volume controls.
* **Curated Presets**: Everyday greeting, Hafez poetry, Saadi wisdom, tech prose, and tongue twisters.
* **Synthesized Audio Download**: Export generated speech as a `.wav` file.

### 🔄 Two-Way Voice Studio (استودیو دوطرفه)
* **Voice Dictation Loop**: Speak in Persian → watch live typing → polish typography → hear it spoken back with 1-click → download as Word DOC.

---

## 🚀 Usage

Open in your browser at `/Persian_Text_to_Speech/index.html` or access it from the Utilities home dashboard.
