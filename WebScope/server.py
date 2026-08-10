from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import tempfile
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import BackgroundTasks, FastAPI, HTTPException
from starlette.background import BackgroundTask
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parent

app = FastAPI(title="WebScope", version="0.2.0")


class Variable(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    value: Any


class ScanRequest(BaseModel):
    url: str = Field(min_length=1)
    variables: list[Variable] = Field(default_factory=list)
    observe_ms: int = Field(default=5000, ge=1000, le=30000)
    max_items: int = Field(default=50, ge=1, le=500)


JOBS: dict[str, dict[str, Any]] = {}


SENSITIVE_HEADERS = {
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
}


def valid_http_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(400, "Target must be an http:// or https:// URL.")
    return value


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        key: "<redacted>" if key.lower() in SENSITIVE_HEADERS else value
        for key, value in headers.items()
    }


def jsonish(content_type: str | None, body: str | bytes = "") -> bool:
    ct = (content_type or "").lower()
    if "json" in ct or "graphql" in ct:
        return True
    if isinstance(body, bytes):
        try:
            body = body[:10000].decode("utf-8", errors="ignore")
        except Exception:
            return False
    stripped = body.lstrip()
    return stripped.startswith("{") or stripped.startswith("[")


def parse_json_safe(text: str) -> Any | None:
    try:
        return json.loads(text)
    except Exception:
        return None


def _value_forms(value: Any) -> set[str]:
    return {x.lower() for x in normalized_forms(value)}


def inspect_json_variable(body: str, variable: Variable, max_nodes: int = 100_000) -> list[dict[str, Any]]:
    """Find matching JSON values without materializing a full flattened tree."""
    data = parse_json_safe(body)
    if data is None:
        return []

    wanted = _value_forms(variable.value)
    hits: list[dict[str, Any]] = []
    visited = 0

    def walk(value: Any, path: str) -> None:
        nonlocal visited
        if visited >= max_nodes or len(hits) >= 100:
            return
        visited += 1

        candidates = {str(value).lower()}
        candidates.update(_value_forms(value))
        if not isinstance(value, (dict, list)) and candidates & wanted:
            hits.append({"path": path, "value": value})

        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, f"{path}.{key}")
                if visited >= max_nodes or len(hits) >= 100:
                    break
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]")
                if visited >= max_nodes or len(hits) >= 100:
                    break

    walk(data, "$")
    return hits


def safe_filename(value: str, fallback: str = "item") -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._-")
    return value[:100] or fallback


def unique_filename(directory: Path, stem: str, suffix: str) -> Path:
    path = directory / f"{stem}{suffix}"
    i = 2
    while path.exists():
        path = directory / f"{stem}_{i}{suffix}"
        i += 1
    return path


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def classify_response(url: str, target_url: str, resource_type: str, content_type: str, body: bytes) -> tuple[str, float, str]:
    host = (urlparse(url).hostname or "").lower()
    target_host = (urlparse(target_url).hostname or "").lower()
    text = url.lower()
    telemetry_tokens = (
        "google-analytics", "googletagmanager", "doubleclick", "sentry",
        "snowplow", "segment", "hotjar", "clarity.ms", "yektanet",
        "digikala.digital", "analytics", "telemetry", "collect", "/track",
        "/events", "/beacon", "fingerprint", "adservice", "advertising"
    )
    if any(token in text for token in telemetry_tokens):
        return "auxiliary", 0.95, "Analytics, telemetry, advertising, or tracking-looking endpoint."
    if host == target_host:
        if resource_type in {"xhr", "fetch"} or "json" in content_type.lower() or "graphql" in content_type.lower():
            return "primary_data", 0.92, "Same-origin API-like response from the target site."
        return "page_resource", 0.60, "Resource belongs to the target site's origin."
    if resource_type in {"xhr", "fetch"} and ("json" in content_type.lower() or "graphql" in content_type.lower()):
        return "secondary_data", 0.70, "Cross-origin structured-data response observed by the target page."
    return "auxiliary", 0.45, "Observed network resource; relevance is uncertain."


async def scan_target(req: ScanRequest) -> dict[str, Any]:
    target = valid_http_url(req.url)
    requests: list[dict[str, Any]] = []
    responses: list[dict[str, Any]] = []
    response_capture_tasks: list[asyncio.Task] = []
    response_bodies: dict[str, bytes] = {}
    response_errors: dict[str, str] = {}

    async with async_playwright() as pw:
        browser_channel = os.environ.get("WEBSCOPE_BROWSER", "chrome")
        launch_kwargs: dict[str, Any] = {"headless": True}
        if browser_channel in {"chrome", "msedge", "chromium"}:
            launch_kwargs["channel"] = browser_channel
        browser = await pw.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1440, "height": 1000},
        )
        page = await context.new_page()

        async def on_request(request):
            requests.append({
                "id": str(uuid.uuid4()),
                "url": request.url,
                "method": request.method,
                "resource_type": request.resource_type,
                "is_navigation": request.is_navigation_request(),
                "headers": redact_headers(await request.all_headers()),
                "post_data": request.post_data,
            })

        async def capture_response(response, rid: str, entry: dict[str, Any]):
            try:
                # Capture bytes immediately. This avoids the common Playwright
                # failure where a response has been navigated away from before
                # Network.getResponseBody is requested.
                body = await response.body()
                response_bodies[rid] = body
                entry["body_captured"] = True
                entry["body_length"] = len(body)
                entry["body_sha256"] = __import__("hashlib").sha256(body).hexdigest()
            except Exception as exc:
                entry["body_captured"] = False
                response_errors[rid] = str(exc)

        async def on_response(response):
            rid = str(uuid.uuid4())
            ct = response.headers.get("content-type", "")
            entry = {
                "id": rid,
                "url": response.url,
                "status": response.status,
                "status_text": response.status_text,
                "content_type": ct,
                "headers": redact_headers(await response.all_headers()),
                "request_url": response.request.url,
                "request_method": response.request.method,
                "resource_type": response.request.resource_type,
                "api_like": response.request.resource_type in {"xhr", "fetch"} or jsonish(ct),
            }
            responses.append(entry)
            # Only capture bodies that can plausibly contain application data.
            # Static assets (images, fonts, CSS, WASM, etc.) still remain in the
            # response metadata but do not consume the API-response budget or memory.
            if entry["api_like"]:
                response_capture_tasks.append(asyncio.create_task(capture_response(response, rid, entry)))

        page.on("request", on_request)
        page.on("response", on_response)

        started = time.time()
        try:
            await page.goto(target, wait_until="domcontentloaded", timeout=30000)
        except PlaywrightTimeoutError:
            pass
        except Exception as exc:
            await browser.close()
            raise HTTPException(502, f"Could not load target: {exc}")

        try:
            await page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightTimeoutError:
            pass

        await page.wait_for_timeout(req.observe_ms)
        if response_capture_tasks:
            await asyncio.gather(*response_capture_tasks, return_exceptions=True)

        final_url = page.url
        title = await page.title()
        html = await page.content()
        body_locator = page.locator("body")
        text = await body_locator.inner_text(timeout=5000) if await body_locator.count() else ""

        scripts = await page.locator("script").evaluate_all(
            "els => els.map(e => ({src:e.src || null, type:e.type || null, text:e.src ? null : e.textContent}))"
        )
        links = await page.locator("a[href]").evaluate_all(
            "els => els.map(e => ({text:(e.innerText||'').trim(), href:e.href})).slice(0,500)"
        )
        forms = await page.locator("form").evaluate_all(
            "els => els.map(e => ({action:e.action, method:e.method, inputs:[...e.querySelectorAll('input,select,textarea')].map(i=>({name:i.name,type:i.type,value:i.value}))}))"
        )
        structured_data = await page.locator('script[type="application/ld+json"]').all_text_contents()
        embedded_json = await page.locator('script[type="application/json"]').all_text_contents()

        await context.close()
        await browser.close()

    # Attach lightweight body metadata only. Actual bodies are written to the
    # artifact directory and are deliberately not returned in the API response.
    for response in responses:
        rid = response["id"]
        if rid in response_errors:
            response["body_error"] = response_errors[rid]
        if rid in response_bodies:
            body = response_bodies[rid]
            response["is_json"] = jsonish(response.get("content_type", ""), body)

    api_responses = [
        r for r in responses
        if r.get("body_captured") and (r.get("api_like") or r.get("is_json"))
    ]

    # Keep evidence bounded. Prefer structured application data from the target
    # origin over telemetry/auxiliary responses when the budget is reached.
    if len(api_responses) > req.max_items:
        target_host = (urlparse(target).hostname or "").lower()
        def response_priority(r: dict[str, Any]) -> tuple[int, int, int]:
            host = (urlparse(r["url"]).hostname or "").lower()
            ct = (r.get("content_type") or "").lower()
            resource = r.get("resource_type") or ""
            return (
                0 if host == target_host else 1,
                0 if resource in {"xhr", "fetch"} and ("json" in ct or "graphql" in ct) else 1,
                0 if "json" in ct or "graphql" in ct else 1,
            )
        api_responses = sorted(api_responses, key=response_priority)[:req.max_items]

    for response in api_responses:
        classification, confidence, reason = classify_response(
            response["url"], target, response.get("resource_type", ""),
            response.get("content_type", ""), response_bodies.get(response["id"], b"")
        )
        response["classification"] = classification
        response["classification_confidence"] = confidence
        response["classification_reason"] = reason

    api_endpoints = []
    seen = set()
    for request in requests:
        if request["resource_type"] in {"xhr", "fetch"}:
            key = (request["method"], request["url"])
            if key not in seen:
                seen.add(key)
                api_endpoints.append({
                    "method": request["method"],
                    "url": request["url"],
                    "resource_type": request["resource_type"],
                    "post_data": request["post_data"],
                })

    variables_report = []
    for var in req.variables:
        matches = []
        matches += find_text_matches(html, var, "html", 20)
        matches += find_text_matches(text, var, "visible_text", 20)
        for i, script in enumerate(scripts):
            if script.get("text"):
                matches += find_text_matches(script["text"], var, f"inline_script[{i}]", 10)
        json_hits = []
        for response in api_responses:
            body_bytes = response_bodies.get(response["id"], b"")
            body = body_bytes.decode("utf-8", errors="replace")
            json_hits.extend([
                {"source": "api_response", "endpoint": response["url"], "response_id": response["id"], **hit}
                for hit in inspect_json_variable(body, var)
            ])
            matches += find_text_matches(body, var, f"api_response:{response['id']}", 20)
        strongest = None
        if json_hits:
            response_rank = {r["id"]: r for r in api_responses}
            ranked = sorted(
                json_hits,
                key=lambda h: (
                    0 if response_rank.get(h.get("response_id"), {}).get("classification") == "primary_data" else 1,
                    0 if response_rank.get(h.get("response_id"), {}).get("classification") == "secondary_data" else 1,
                    len(h.get("path", "")),
                ),
            )
            strongest = {
                "endpoint": ranked[0].get("endpoint"),
                "response_id": ranked[0].get("response_id"),
                "json_path": ranked[0].get("path"),
                "value": ranked[0].get("value"),
            }
        variables_report.append({
            "name": var.name,
            "supplied_value": var.value,
            "matches": matches[:100],
            "json_path_matches": json_hits[:100],
            "strongest_source": strongest,
        })

    return {
        "webscope_version": "0.2.0",
        "scan": {
            "started_at_epoch": started,
            "duration_seconds": round(time.time() - started, 3),
            "observation_ms": req.observe_ms,
            "max_items": req.max_items,
        },
        "target": {
            "input_url": target,
            "final_url": final_url,
            "title": title,
            "same_page_navigation": final_url == target,
        },
        "page": {
            "html": html,
            "visible_text": text,
            "scripts": scripts,
            "links": links,
            "forms": forms,
            "json_ld": [parse_json_safe(x) or x for x in structured_data],
            "embedded_json": [parse_json_safe(x) or x for x in embedded_json],
        },
        "network": {
            "requests": requests,
            "responses": responses,
            "api_endpoints": api_endpoints,
            "api_responses": api_responses,
        },
        "variables": variables_report,
        "_body_bytes": response_bodies,
        "scraper_hints": {
            "mode": "informer",
            "priority": "Prefer captured API/XHR/fetch/GraphQL sources over DOM selectors when they expose requested data.",
            "api_endpoint_count": len(api_endpoints),
            "api_response_count": len(api_responses),
            "json_response_count": sum(1 for r in api_responses if r.get("is_json")),
            "notes": [
                "WebScope does not follow discovered page links.",
                "Observed network requests are evidence generated by the supplied page, not permission to crawl unrelated destinations.",
                "Known-variable matches are evidence, not a guarantee that the matched value is the canonical source.",
                "Response bodies are exported individually so large responses do not make one monolithic report.",
                "Sensitive request/response headers are redacted in exported metadata.",
            ],
        },
    }


def build_artifact(report: dict[str, Any], artifact_dir: Path) -> dict[str, Any]:
    artifact_dir.mkdir(parents=True, exist_ok=True)
    body_bytes: dict[str, bytes] = report.pop("_body_bytes", {})

    write_json(artifact_dir / "manifest.json", {
        "format": "WebScope Agent Evidence Bundle",
        "format_version": "1.0",
        "webscope_version": report["webscope_version"],
        "target": report["target"],
        "contents": {
            "variables": "variables/*.json",
            "api_responses": "api_responses/*/meta.json + body.*",
            "network": "network/*.json",
            "page": "page/*",
            "agent_guidance": "agent_instructions.md",
        },
        "counts": {
            "variables": len(report["variables"]),
            "api_responses": len(report["network"]["api_responses"]),
            "requests": len(report["network"]["requests"]),
            "responses": len(report["network"]["responses"]),
        },
    })

    write_json(artifact_dir / "scan_summary.json", report["scan"])
    write_json(artifact_dir / "target.json", report["target"])
    write_json(artifact_dir / "network" / "requests.json", report["network"]["requests"])
    write_json(artifact_dir / "network" / "responses.json", report["network"]["responses"])
    write_json(artifact_dir / "network" / "api_endpoints.json", report["network"]["api_endpoints"])

    write_json(artifact_dir / "page" / "scripts.json", report["page"]["scripts"])
    write_json(artifact_dir / "page" / "links.json", report["page"]["links"])
    write_json(artifact_dir / "page" / "forms.json", report["page"]["forms"])
    write_json(artifact_dir / "page" / "json_ld.json", report["page"]["json_ld"])
    write_json(artifact_dir / "page" / "embedded_json.json", report["page"]["embedded_json"])
    (artifact_dir / "page" / "rendered.html").write_text(report["page"]["html"], encoding="utf-8")
    (artifact_dir / "page" / "visible_text.txt").write_text(report["page"]["visible_text"], encoding="utf-8")

    variable_dir = artifact_dir / "variables"
    variable_dir.mkdir(exist_ok=True)
    for var in report["variables"]:
        name = safe_filename(var["name"], "variable")
        write_json(variable_dir / f"{name}.json", var)
    write_json(variable_dir / "index.json", {
        "variables": [
            {"name": v["name"], "supplied_value": v["supplied_value"], "file": f"{safe_filename(v['name'], 'variable')}.json"}
            for v in report["variables"]
        ]
    })

    api_dir = artifact_dir / "api_responses"
    api_dir.mkdir(exist_ok=True)
    api_index = []
    for index, response in enumerate(report["network"]["api_responses"], start=1):
        rid = response["id"]
        folder = api_dir / f"{index:04d}_{safe_filename(response.get('request_method', 'GET').lower())}_{safe_filename(urlparse(response['url']).path.split('/')[-1], 'response')}"
        folder.mkdir(exist_ok=True)
        body = body_bytes.get(rid, b"")
        is_json = bool(response.get("is_json"))
        body_name = "body.json" if is_json else "body.bin"
        if is_json:
            try:
                pretty = json.dumps(json.loads(body.decode("utf-8")), ensure_ascii=False, indent=2).encode("utf-8")
                (folder / body_name).write_bytes(pretty)
            except Exception:
                (folder / body_name).write_bytes(body)
        else:
            (folder / body_name).write_bytes(body)
        meta = {k: v for k, v in response.items() if k not in {"json"}}
        meta["body_file"] = f"api_responses/{folder.name}/{body_name}"
        write_json(folder / "meta.json", meta)
        api_index.append({
            "index": index,
            "response_id": rid,
            "url": response["url"],
            "method": response["request_method"],
            "status": response["status"],
            "content_type": response.get("content_type", ""),
            "classification": response.get("classification", "unknown"),
            "classification_confidence": response.get("classification_confidence"),
            "body_file": meta["body_file"],
            "metadata_file": f"api_responses/{folder.name}/meta.json",
        })
    write_json(api_dir / "index.json", api_index)

    report_for_agent = {
        "webscope_version": report["webscope_version"],
        "scan": report["scan"],
        "target": report["target"],
        "page": {
            "files": {
                "rendered_html": "page/rendered.html",
                "visible_text": "page/visible_text.txt",
                "scripts": "page/scripts.json",
                "links": "page/links.json",
                "forms": "page/forms.json",
                "json_ld": "page/json_ld.json",
                "embedded_json": "page/embedded_json.json"
            }
        },
        "network": {
            "files": {
                "requests": "network/requests.json",
                "responses": "network/responses.json",
                "api_endpoints": "network/api_endpoints.json",
                "api_responses_index": "api_responses/index.json"
            }
        },
        "variables": [
            {
                "name": v["name"],
                "supplied_value": v["supplied_value"],
                "match_count": len(v.get("matches", [])),
                "json_path_match_count": len(v.get("json_path_matches", [])),
                "strongest_source": v.get("strongest_source"),
                "file": f"variables/{safe_filename(v['name'], 'variable')}.json",
            }
            for v in report["variables"]
        ],
        "scraper_hints": report["scraper_hints"],
    }
    write_json(artifact_dir / "report.json", report_for_agent)

    instructions = f"""# WebScope Agent Evidence Bundle\n\nThis bundle is evidence collected from one supplied URL. WebScope is an informer, not a scraper.\n\n## Recommended agent workflow\n1. Read `manifest.json` and `report.json`.\n2. Read `variables/index.json`, then open the individual variable files that matter.\n3. Read `network/api_endpoints.json` to find likely data sources.\n4. Read `api_responses/index.json`, then inspect individual `meta.json` and `body.json`/`body.bin` files.\n5. Prefer an observed API response that contains the requested data over brittle DOM selectors.\n6. Use request method, URL, query string, request body and response shape from the evidence when implementing the scraper.\n7. Treat every response as separate evidence; do not assume two endpoints are interchangeable.\n8. If a response body is missing, use its metadata and look for another observed response.\n9. Never assume a discovered URL was crawled: only the supplied page was loaded.\n\n## Bundle counts\n- Variables: {len(report['variables'])}\n- API responses with bodies: {len(report['network']['api_responses'])}\n- Requests: {len(report['network']['requests'])}\n- Responses: {len(report['network']['responses'])}\n\n## Important\nSensitive authentication/cookie headers are redacted. This bundle describes what the page exposed during observation; it does not contain credentials.\n"""
    (artifact_dir / "agent_instructions.md").write_text(instructions, encoding="utf-8")

    return {
        "artifact_dir": str(artifact_dir),
        "api_response_count": len(api_index),
        "variable_count": len(report["variables"]),
    }


@app.get("/")
async def index():
    index_file = ROOT / "templates" / "index.html"
    if not index_file.exists():
        raise HTTPException(500, f"WebScope UI not found: {index_file}")
    return FileResponse(index_file, media_type="text/html")


def cleanup_file(path: Path, job_id: str | None = None) -> None:
    """Delete the temporary evidence ZIP/directory and release its job entry."""
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass
    try:
        parent = path.parent
        if parent.name.startswith("webscope-"):
            shutil.rmtree(parent, ignore_errors=True)
    except Exception:
        pass
    if job_id:
        JOBS.pop(job_id, None)


def cleanup_dir(path: Path) -> None:
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass


def make_temp_artifact_root() -> Path:
    """Create a temporary location outside the project repository."""
    return Path(tempfile.mkdtemp(prefix="webscope-"))


async def run_job(job_id: str, req: ScanRequest):
    job = JOBS[job_id]
    temp_root: Path | None = None
    try:
        job["stage"] = "loading"
        job["message"] = "Loading the target page and executing JavaScript…"
        report = await scan_target(req)

        job["stage"] = "organizing"
        job["message"] = "Organizing evidence and matching known variables…"

        temp_root = make_temp_artifact_root()
        artifact_dir = temp_root / "bundle"
        build_artifact(report, artifact_dir)

        job["stage"] = "packaging"
        job["message"] = "Packaging the evidence bundle…"

        zip_path = temp_root / f"webscope-evidence-{int(time.time())}-{uuid.uuid4().hex[:8]}.zip"
        with zipfile.ZipFile(
            zip_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=6,
        ) as zf:
            for file in artifact_dir.rglob("*"):
                if file.is_file():
                    zf.write(file, file.relative_to(artifact_dir))

        # Do not keep the unpacked evidence. The ZIP is the only artifact
        # retained, and it lives outside the project directory.
        cleanup_dir(artifact_dir)

        # Keep the in-memory job result deliberately tiny. In particular,
        # never send hundreds of network events / response metadata to the UI.
        summary = {
            "webscope_version": report["webscope_version"],
            "scan": report["scan"],
            "target": report["target"],
            "counts": {
                "requests": len(report["network"]["requests"]),
                "responses": len(report["network"]["responses"]),
                "api_endpoints": len(report["network"]["api_endpoints"]),
                "api_responses": len(report["network"]["api_responses"]),
                "json_responses": sum(
                    1 for r in report["network"]["api_responses"] if r.get("is_json")
                ),
                "variable_evidence": sum(
                    len(v.get("matches", [])) + len(v.get("json_path_matches", []))
                    for v in report["variables"]
                ),
            },
            "variables": [
                {
                    "name": v["name"],
                    "supplied_value": v["supplied_value"],
                    "match_count": len(v.get("matches", [])),
                    "json_path_match_count": len(v.get("json_path_matches", [])),
                    "strongest_source": v.get("strongest_source"),
                }
                for v in report["variables"]
            ],
        }

        # Release the large in-memory report as soon as the ZIP has been built.
        del report

        job.update({
            "stage": "complete",
            "message": "Investigation complete. Your evidence ZIP is ready.",
            "summary": summary,
            "download_url": f"/api/download/{zip_path.name}",
            "_zip_path": str(zip_path),
        })

    except HTTPException as exc:
        if temp_root:
            cleanup_dir(temp_root)
        job.update({"stage": "error", "message": str(exc.detail)})
    except Exception as exc:
        if temp_root:
            cleanup_dir(temp_root)
        job.update({"stage": "error", "message": str(exc)})


@app.post("/api/scan")

async def scan(req: ScanRequest, background_tasks: BackgroundTasks):
    valid_http_url(req.url)
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {
        "stage": "queued",
        "message": "Starting investigation…",
        "progress": 0,
    }
    background_tasks.add_task(run_job, job_id, req)
    return {"job_id": job_id}


@app.get("/api/scan/{job_id}")
async def scan_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Scan job not found")
    return job


@app.get("/api/download/{filename}")
async def download(filename: str):
    safe = Path(filename).name
    if not safe.startswith("webscope-evidence-") or not safe.endswith(".zip"):
        raise HTTPException(404, "Artifact not found")

    # Jobs keep their temporary ZIP path in memory only. No output directory
    # is created inside the project.
    path = None
    job_id = None
    for candidate_id, job in JOBS.items():
        if Path(job.get("_zip_path", "")).name == safe:
            path = Path(job["_zip_path"])
            job_id = candidate_id
            break

    if not path or not path.exists():
        raise HTTPException(404, "Artifact not found")

    return FileResponse(
        path,
        media_type="application/zip",
        filename=safe,
        background=BackgroundTask(cleanup_file, path, job_id),
    )
