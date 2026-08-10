# WebScope v0.1

WebScope is a local-first website intelligence application. Give it one URL and it analyzes that page before a scraper is written.

## Stack
- FastAPI
- nodriver
- httpx
- BeautifulSoup/lxml
- Plain HTML/CSS/JS

## v0.1
- robots.txt check with explicit ignore option
- direct HTTP inspection
- rendered browser inspection
- structured data / JSON-LD / embedded JSON
- DOM structure, links, forms, tables, images
- repeated DOM structure hints
- REST and GraphQL candidate detection
- browser resource inventory
- technology hints
- observed WebSocket endpoints only (no message subsystem)
- organized report and JSON export
- safe same-origin GET replay endpoint

The supplied URL is not recursively crawled. No LLM is used. No remote WebScope server is required.

## Run
```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python run.py
```
Open `http://127.0.0.1:8000`.

A Chromium-based browser should be installed because nodriver uses the client's browser. WebScope's local server serves the frontend and performs the analysis on the same machine.

## Next phase
The next major layer is the **Data/API Explorer + scraper construction workflow**: inspect a large API response as a navigable tree, select fields, reconstruct useful requests, and turn the selected evidence into a minimal scraper definition. Scraper generation itself is intentionally not part of v0.1.
