"""One-command WebScope launcher.

Run:
    python run.py

WebScope uses an already-installed browser (Chrome by default, with Edge
supported by the server). It deliberately does NOT run:
    python -m playwright install chromium
"""

from __future__ import annotations

import os
import platform
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
REQ = ROOT / "requirements.txt"
HOST = "127.0.0.1"
PORT = "8000"


def run(cmd: list[str], *, env: dict[str, str] | None = None):
    print(">", " ".join(map(str, cmd)))
    return subprocess.run(cmd, cwd=ROOT, check=True, env=env)


def vpy() -> Path:
    return (
        VENV / "Scripts" / "python.exe"
        if platform.system() == "Windows"
        else VENV / "bin" / "python"
    )


def ensure_venv() -> Path:
    if sys.prefix != sys.base_prefix:
        print("[1/3] Using current virtual environment.")
        return Path(sys.executable)

    p = vpy()

    if not p.exists():
        print("[1/3] Creating WebScope virtual environment...")
        run([sys.executable, "-m", "venv", str(VENV)])
    else:
        print("[1/3] Virtual environment already exists.")

    return p


def ensure_deps(p: Path) -> None:
    print("[2/3] Installing/checking dependencies...")
    run([
        str(p),
        "-m",
        "pip",
        "install",
        "-r",
        str(REQ),
        "--disable-pip-version-check",
    ])


def detect_system_browser() -> str | None:
    """Find an installed browser that Playwright can launch by channel."""

    if platform.system() == "Windows":
        candidates = [
            (
                "chrome",
                [
                    Path(os.environ.get("PROGRAMFILES", ""))
                    / "Google/Chrome/Application/chrome.exe",
                    Path(os.environ.get("PROGRAMFILES(X86)", ""))
                    / "Google/Chrome/Application/chrome.exe",
                    Path(os.environ.get("LOCALAPPDATA", ""))
                    / "Google/Chrome/Application/chrome.exe",
                ],
            ),
            (
                "msedge",
                [
                    Path(os.environ.get("PROGRAMFILES", ""))
                    / "Microsoft/Edge/Application/msedge.exe",
                    Path(os.environ.get("PROGRAMFILES(X86)", ""))
                    / "Microsoft/Edge/Application/msedge.exe",
                    Path(os.environ.get("LOCALAPPDATA", ""))
                    / "Microsoft/Edge/Application/msedge.exe",
                ],
            ),
        ]

        for channel, paths in candidates:
            for exe in paths:
                if exe.name and exe.exists():
                    return channel

    else:
        commands = [
            ("google-chrome", "chrome"),
            ("google-chrome-stable", "chrome"),
            ("microsoft-edge", "msedge"),
            ("chromium", "chromium"),
            ("chromium-browser", "chromium"),
        ]

        for executable, channel in commands:
            result = subprocess.run(
                ["which", executable],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if result.returncode == 0:
                return channel

    return None


def start(p: Path) -> None:
    print("[3/3] Starting WebScope...")

    browser = detect_system_browser()

    if browser:
        print(f"Using installed browser: {browser}")
    else:
        print(
            "\nWARNING: No installed Chrome/Edge browser was detected.\n"
            "WebScope will start, but scans require a supported browser.\n"
        )

    print(f"WebScope: http://{HOST}:{PORT}")
    print("Keep this terminal open. Press Ctrl+C to stop.")

    def open_ui():
        time.sleep(1.2)
        webbrowser.open(f"http://{HOST}:{PORT}")

    import threading
    threading.Thread(target=open_ui, daemon=True).start()

    env = os.environ.copy()

    # server.py already supports this environment variable.
    if browser:
        env["WEBSCOPE_BROWSER"] = browser
    else:
        env.pop("WEBSCOPE_BROWSER", None)

    run([
        str(p),
        "-m",
        "uvicorn",
        "server:app",
        "--host",
        HOST,
        "--port",
        PORT,
    ], env=env)


def main() -> None:
    print("=" * 58)
    print(" WebScope — Website intelligence for AI-built scrapers")
    print("=" * 58)

    try:
        p = ensure_venv()
        ensure_deps(p)
        start(p)

    except KeyboardInterrupt:
        print("\nWebScope stopped.")

    except subprocess.CalledProcessError as e:
        print(f"\nWebScope could not start. Exit code: {e.returncode}")
        raise SystemExit(e.returncode)

    except Exception as e:
        print(f"\nWebScope could not start: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
