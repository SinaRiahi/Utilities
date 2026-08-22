import io
import os
import secrets
import socket
import threading
import webbrowser
from pathlib import Path

import qrcode
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).resolve().parent
DEFAULT_TRANSFER_DIR = APP_DIR / "transfers"
DEFAULT_TRANSFER_DIR.mkdir(exist_ok=True)
SETTINGS_FILE = APP_DIR / "settings.txt"

TOKEN = secrets.token_urlsafe(24)
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024

app = FastAPI(title="Utilities File Transfer", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")


def get_transfer_dir() -> Path:
    try:
        if SETTINGS_FILE.exists():
            configured = SETTINGS_FILE.read_text(encoding="utf-8").strip()
            if configured:
                path = Path(configured).expanduser()
                path.mkdir(parents=True, exist_ok=True)
                return path
    except OSError:
        pass
    DEFAULT_TRANSFER_DIR.mkdir(exist_ok=True)
    return DEFAULT_TRANSFER_DIR


TRANSFER_DIR = get_transfer_dir()


def local_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return "127.0.0.1"


def safe_name(name: str) -> str:
    name = Path(name or "unnamed").name
    return "".join(c if c.isalnum() or c in " .-_()" else "_" for c in name).strip() or "unnamed"


def check_token(token: str | None) -> None:
    if not token or not secrets.compare_digest(token, TOKEN):
        raise HTTPException(status_code=403, detail="Invalid transfer token")


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (APP_DIR / "static" / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


@app.get("/api/session")
async def session(token: str | None = Query(default=None)):
    check_token(token)
    return {
        "name": socket.gethostname(),
        "ip": local_ip(),
        "token": TOKEN,
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "transfer_dir": str(TRANSFER_DIR),
    }


@app.get("/api/files")
async def list_files(token: str | None = Query(default=None)):
    check_token(token)
    items = []
    for p in sorted(TRANSFER_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file():
            items.append({
                "name": p.name,
                "size": p.stat().st_size,
                "modified": p.stat().st_mtime,
            })
    return items


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    token: str | None = Query(default=None),
):
    check_token(token)
    filename = safe_name(file.filename)
    destination = TRANSFER_DIR / filename

    if destination.exists():
        stem, suffix = destination.stem, destination.suffix
        counter = 1
        while destination.exists():
            destination = TRANSFER_DIR / f"{stem} ({counter}){suffix}"
            counter += 1

    written = 0
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    output.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File is too large")
                output.write(chunk)
    finally:
        await file.close()

    return {"name": destination.name, "size": written}


@app.get("/api/download/{filename}")
async def download_file(filename: str, token: str | None = Query(default=None)):
    check_token(token)
    safe = safe_name(filename)
    path = TRANSFER_DIR / safe
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


@app.delete("/api/files/{filename}")
async def delete_file(filename: str, token: str | None = Query(default=None)):
    check_token(token)
    path = TRANSFER_DIR / safe_name(filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    path.unlink()
    return {"ok": True}


@app.post("/api/clean")
async def clean_transfer(token: str | None = Query(default=None)):
    check_token(token)
    deleted = 0
    errors = []
    for p in list(TRANSFER_DIR.iterdir()):
        if p.is_file():
            try:
                p.unlink()
                deleted += 1
            except OSError as exc:
                errors.append(f"{p.name}: {exc}")
    return {"ok": not errors, "deleted": deleted, "errors": errors}


@app.get("/qr")
async def qr(token: str | None = Query(default=None)):
    check_token(token)
    url = f"http://{local_ip()}:8765/?token={TOKEN}"
    image = qrcode.make(url)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@app.get("/api/settings")
async def settings(token: str | None = Query(default=None)):
    check_token(token)
    return {"transfer_dir": str(TRANSFER_DIR)}


@app.post("/api/settings/folder")
async def set_folder(token: str | None = Query(default=None), path: str = ""):
    check_token(token)
    global TRANSFER_DIR
    if not path.strip():
        raise HTTPException(status_code=400, detail="Folder path is required")
    target = Path(path.strip()).expanduser().resolve()
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot use folder: {exc}")
    try:
        SETTINGS_FILE.write_text(str(target), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot save setting: {exc}")
    TRANSFER_DIR = target
    return {"transfer_dir": str(TRANSFER_DIR)}


def print_connection_info():
    ip = local_ip()
    print()
    print("Utilities File Transfer")
    print("-----------------------")
    print(f"PC:     http://127.0.0.1:8765/?token={TOKEN}")
    print(f"Mobile: http://{ip}:8765/?token={TOKEN}")
    print("Scan the QR code shown in the browser to connect a phone.")
    print("Keep both devices on the same Wi-Fi/LAN.")
    print()


if __name__ == "__main__":
    import uvicorn
    print_connection_info()
    webbrowser.open(f"http://127.0.0.1:8765/?token={TOKEN}")
    uvicorn.run(app, host="0.0.0.0", port=8765)
