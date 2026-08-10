import os, webbrowser
from threading import Timer
import uvicorn

def open_browser():
    if os.environ.get("WEBSCOPE_NO_BROWSER") != "1":
        webbrowser.open("http://127.0.0.1:8000")
if __name__ == "__main__":
    Timer(1.2, open_browser).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
