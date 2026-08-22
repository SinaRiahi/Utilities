import threading
import time
import webbrowser
import uvicorn

from app import app, TOKEN

def open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:8765/?token={TOKEN}")

if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")
