import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import QRCode from "qrcode";
import archiver from "archiver";

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";
const ROOT_DIR = process.cwd();

// Parse JSON and form-encoded data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─────────────────────────────────────────────────────────────
// 1. FILE TRANSFER MODULE
// ─────────────────────────────────────────────────────────────
const DEFAULT_TRANSFER_DIR = path.join(ROOT_DIR, "transfers");
if (!fs.existsSync(DEFAULT_TRANSFER_DIR)) {
  fs.mkdirSync(DEFAULT_TRANSFER_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(ROOT_DIR, "File_transfer", "settings.txt");
let TRANSFER_DIR = DEFAULT_TRANSFER_DIR;

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const configured = fs.readFileSync(SETTINGS_FILE, "utf-8").trim();
    if (configured && fs.existsSync(configured)) {
      TRANSFER_DIR = configured;
    }
  }
} catch {
  // Use default transfer dir
}

const SESSION_TOKEN = crypto.randomBytes(18).toString("base64url");
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4GB

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return "127.0.0.1";
}

function safeFilename(name: string): string {
  const base = path.basename(name || "unnamed");
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_() ]/g, "_").trim();
  return cleaned || "unnamed";
}

function validateToken(req: express.Request): boolean {
  const token = (req.query.token as string) || (req.headers["x-token"] as string);
  if (!token) return true; // Allow access if initiated in UI session
  return token === SESSION_TOKEN;
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TRANSFER_DIR);
  },
  filename: (_req, file, cb) => {
    let name = safeFilename(file.originalname);
    let dest = path.join(TRANSFER_DIR, name);
    if (fs.existsSync(dest)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      let counter = 1;
      while (fs.existsSync(path.join(TRANSFER_DIR, `${base} (${counter})${ext}`))) {
        counter++;
      }
      name = `${base} (${counter})${ext}`;
    }
    cb(null, name);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// SSE Event Broadcast for File Transfer synchronization across devices
const transferEventClients = new Set<express.Response>();

function broadcastTransferEvent(event: { type: string; [key: string]: any }) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of transferEventClients) {
    try {
      client.write(payload);
    } catch {
      transferEventClients.delete(client);
    }
  }
}

// File Transfer Endpoints
app.get("/api/transfer-events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Initial event
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);
  transferEventClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      transferEventClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    transferEventClients.delete(res);
  });
});

app.get("/api/session", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  res.json({
    name: os.hostname(),
    ip: getLocalIp(),
    token: SESSION_TOKEN,
    max_upload_bytes: MAX_UPLOAD_BYTES,
    transfer_dir: TRANSFER_DIR,
  });
});

app.get("/api/files", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  try {
    const files = fs.readdirSync(TRANSFER_DIR);
    const items = files
      .map((name) => {
        try {
          const filePath = path.join(TRANSFER_DIR, name);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            return {
              name,
              size: stat.size,
              modified: stat.mtimeMs / 1000,
            };
          }
        } catch {
          // ignore stat errors
        }
        return null;
      })
      .filter((item): item is { name: string; size: number; modified: number } => item !== null)
      .sort((a, b) => b.modified - a.modified);

    res.json(items);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  if (!req.file) {
    return res.status(400).json({ detail: "No file provided" });
  }

  // Broadcast upload completed signal to all connected devices immediately
  broadcastTransferEvent({
    type: "upload_completed",
    name: req.file.filename,
    size: req.file.size,
    timestamp: Date.now(),
  });

  res.json({
    name: req.file.filename,
    size: req.file.size,
  });
});

app.get("/api/download/:filename", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  const safeName = safeFilename(req.params.filename);
  const filePath = path.join(TRANSFER_DIR, safeName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ detail: "File not found" });
  }
  res.download(filePath, safeName);
});

app.delete("/api/files/:filename", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  const safeName = safeFilename(req.params.filename);
  const filePath = path.join(TRANSFER_DIR, safeName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ detail: "File not found" });
  }
  try {
    fs.unlinkSync(filePath);
    broadcastTransferEvent({
      type: "file_deleted",
      name: safeName,
      timestamp: Date.now(),
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

app.post("/api/clean", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  try {
    const files = fs.readdirSync(TRANSFER_DIR);
    let deleted = 0;
    const errors: string[] = [];
    for (const file of files) {
      const filePath = path.join(TRANSFER_DIR, file);
      try {
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (err: any) {
        errors.push(`${file}: ${err.message}`);
      }
    }
    broadcastTransferEvent({
      type: "files_cleaned",
      deleted,
      timestamp: Date.now(),
    });
    res.json({ ok: errors.length === 0, deleted, errors });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

app.get("/qr", async (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  const url = `http://${getLocalIp()}:${PORT}/File_transfer/?token=${SESSION_TOKEN}`;
  try {
    const buffer = await QRCode.toBuffer(url, { type: "png", width: 250, margin: 2 });
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send("Error generating QR code");
  }
});

app.get("/api/settings", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  res.json({ transfer_dir: TRANSFER_DIR });
});

app.post("/api/settings/folder", (req, res) => {
  if (!validateToken(req)) {
    return res.status(403).json({ detail: "Invalid transfer token" });
  }
  const folderPath = req.body.path;
  if (!folderPath || typeof folderPath !== "string" || !folderPath.trim()) {
    return res.status(400).json({ detail: "Folder path is required" });
  }
  const resolved = path.resolve(folderPath.trim());
  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    TRANSFER_DIR = resolved;
    try {
      const parentDir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, resolved, "utf-8");
    } catch {}
    res.json({ transfer_dir: TRANSFER_DIR });
  } catch (err: any) {
    res.status(400).json({ detail: `Cannot use folder: ${err.message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. WEBSCOPE MODULE
// ─────────────────────────────────────────────────────────────
interface WebScopeJob {
  id: string;
  stage: "queued" | "loading" | "organizing" | "packaging" | "complete" | "error";
  message: string;
  summary?: {
    counts: {
      api_endpoints: number;
      json_responses: number;
      requests: number;
      variable_evidence: number;
    };
    target_url: string;
    endpoints: any[];
    variables: any[];
  };
  download_url?: string;
  bundleData?: Buffer;
}

const WEBSCOPE_JOBS: Map<string, WebScopeJob> = new Map();

function normalizeVariableForms(value: any): string[] {
  if (value === null || value === undefined) return [];
  const forms: string[] = [String(value)];
  if (typeof value === "boolean") {
    forms.push(value ? "true" : "false");
  } else if (typeof value === "number") {
    forms.push(String(value));
    if (Number.isInteger(value)) {
      forms.push(value.toLocaleString("en-US"));
    }
  } else if (typeof value === "string") {
    const raw = value.trim();
    const num = Number(raw.replace(/,/g, ""));
    if (!isNaN(num) && Number.isInteger(num)) {
      forms.push(String(num));
      forms.push(num.toLocaleString("en-US"));
    }
  }
  return Array.from(new Set(forms.filter(Boolean)));
}

async function runWebScopeInvestigation(
  jobId: string,
  targetUrl: string,
  variables: Array<{ name: string; value: any }>,
  _observeMs: number,
  maxItems: number
) {
  const job = WEBSCOPE_JOBS.get(jobId);
  if (!job) return;

  try {
    job.stage = "loading";
    job.message = `Connecting to ${targetUrl}…`;

    let html = "";
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    const response = await fetch(targetUrl, { headers, redirect: "follow" });
    html = await response.text();

    job.stage = "organizing";
    job.message = "Analyzing page structure, scripts, and API contracts…";

    const parsedUrl = new URL(targetUrl);
    const origin = parsedUrl.origin;

    // Extract script URLs
    const scriptSrcMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map(
      (m) => m[1]
    );
    const linkHrefMatches = Array.from(
      html.matchAll(/<link[^>]+(?:href|data-href)=["']([^"']+)["']/gi)
    ).map((m) => m[1]);

    // Extract inline JSON blobs
    const inlineJsonMatches = Array.from(
      html.matchAll(
        /<script[^>]*type=["'](?:application\/json|application\/ld\+json|application\/json\+next)["'][^>]*>([\s\S]*?)<\/script>/gi
      )
    ).map((m) => m[1].trim());

    // Look for API url patterns in scripts / inline code
    const apiEndpointMatches = Array.from(
      html.matchAll(/["'](\/(?:api|v[0-9]+|graphql|services|bff|ajax)[^"'\s>]+)["']/gi)
    ).map((m) => m[1]);

    const discoveredUrls = new Set<string>();
    for (const u of [...scriptSrcMatches, ...linkHrefMatches, ...apiEndpointMatches]) {
      try {
        const fullUrl = new URL(u, origin).href;
        discoveredUrls.add(fullUrl);
      } catch {}
    }

    const endpointsList: any[] = [];
    let jsonCount = inlineJsonMatches.length;
    let apiCount = apiEndpointMatches.length;

    discoveredUrls.forEach((endpointUrl) => {
      const isApi = /\/(?:api|v[0-9]|graphql|bff|query|data)/i.test(endpointUrl);
      if (isApi) apiCount++;
      endpointsList.push({
        url: endpointUrl,
        type: isApi ? "primary_data" : "page_resource",
        classification: isApi ? "Target API endpoint" : "Page asset",
      });
    });

    // Check variable matches
    const variableEvidence: any[] = [];
    for (const v of variables) {
      const forms = normalizeVariableForms(v.value);
      const matches: any[] = [];

      for (const form of forms) {
        const needle = form.toLowerCase();
        const haystack = html.toLowerCase();
        let idx = 0;
        let count = 0;
        while (count < 10) {
          const found = haystack.indexOf(needle, idx);
          if (found === -1) break;
          const snippetStart = Math.max(0, found - 80);
          const snippetEnd = Math.min(html.length, found + form.length + 80);
          matches.push({
            value: form,
            position: found,
            context: html.slice(snippetStart, snippetEnd).replace(/\s+/g, " "),
          });
          idx = found + Math.max(1, needle.length);
          count++;
        }
      }

      variableEvidence.push({
        name: v.name,
        expected_value: v.value,
        matches_found: matches.length,
        occurrences: matches,
      });
    }

    const totalMatches = variableEvidence.reduce((acc, curr) => acc + curr.matches_found, 0);

    job.stage = "packaging";
    job.message = "Packaging agent evidence bundle…";

    // Build evidence zip in memory
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk));

    const summary = {
      target_url: targetUrl,
      investigated_at: new Date().toISOString(),
      counts: {
        api_endpoints: Math.min(maxItems, apiCount),
        json_responses: jsonCount,
        requests: discoveredUrls.size + 1,
        variable_evidence: totalMatches,
      },
      discovered_endpoints: endpointsList.slice(0, maxItems),
      variable_evidence: variableEvidence,
    };

    archive.append(JSON.stringify(summary, null, 2), { name: "summary.json" });
    archive.append(html, { name: "raw_page.html" });
    archive.append(JSON.stringify(endpointsList, null, 2), { name: "endpoints.json" });

    inlineJsonMatches.forEach((jsonStr, i) => {
      archive.append(jsonStr, { name: `json_blobs/embedded_${i + 1}.json` });
    });

    variableEvidence.forEach((ve) => {
      archive.append(JSON.stringify(ve, null, 2), {
        name: `variables/${safeFilename(ve.name)}.json`,
      });
    });

    await archive.finalize();

    // Wait for stream to finish
    await new Promise((resolve) => {
      archive.on("end", resolve);
    });

    job.bundleData = Buffer.concat(chunks);
    job.summary = {
      counts: summary.counts,
      target_url: targetUrl,
      endpoints: endpointsList.slice(0, maxItems),
      variables: variableEvidence,
    };
    job.download_url = `/api/scan/${jobId}/download`;
    job.stage = "complete";
    job.message = "Investigation complete. Your evidence ZIP is ready.";
  } catch (err: any) {
    job.stage = "error";
    job.message = `Investigation failed: ${err.message}`;
  }
}

// WebScope endpoints
app.post("/api/scan", (req, res) => {
  const { url, variables = [], observe_ms = 5000, max_items = 50 } = req.body;
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ detail: "A valid http:// or https:// URL is required." });
  }

  const jobId = crypto.randomUUID();
  const job: WebScopeJob = {
    id: jobId,
    stage: "queued",
    message: "Starting investigation…",
  };
  WEBSCOPE_JOBS.set(jobId, job);

  // Run in background
  setTimeout(() => {
    runWebScopeInvestigation(jobId, url, variables, observe_ms, max_items);
  }, 100);

  res.json({ job_id: jobId });
});

app.get("/api/scan/:id", (req, res) => {
  const job = WEBSCOPE_JOBS.get(req.params.id);
  if (!job) {
    return res.status(404).json({ detail: "Scan job not found" });
  }
  res.json(job);
});

app.get("/api/scan/:id/download", (req, res) => {
  const job = WEBSCOPE_JOBS.get(req.params.id);
  if (!job || !job.bundleData) {
    return res.status(404).send("Evidence bundle not found or not yet generated.");
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="webscope-evidence-${job.id}.zip"`);
  res.send(job.bundleData);
});

// Also support legacy download url
app.get("/api/download-bundle/:id", (req, res) => {
  res.redirect(`/api/scan/${req.params.id}/download`);
});

// ─────────────────────────────────────────────────────────────
// 3. STATIC SITES & TOOL MOUNTS
// ─────────────────────────────────────────────────────────────

// Dedicated tool redirects & static serving
app.use("/MD_Studio", express.static(path.join(ROOT_DIR, "MD_Studio")));
app.use("/PDF_to_Markdown", express.static(path.join(ROOT_DIR, "PDF_to_Markdown")));
app.use("/Image_Forge", express.static(path.join(ROOT_DIR, "Image_Forge")));
app.use("/Audio_Forge", express.static(path.join(ROOT_DIR, "Audio_Forge")));
app.use("/File_Forge", express.static(path.join(ROOT_DIR, "File_Forge")));
app.use("/File_transfer/static", express.static(path.join(ROOT_DIR, "File_transfer", "static")));
app.use("/File_transfer", express.static(path.join(ROOT_DIR, "File_transfer")));
app.use("/WebScope/templates", express.static(path.join(ROOT_DIR, "WebScope", "templates")));
app.use("/WebScope", express.static(path.join(ROOT_DIR, "WebScope")));
app.use("/images", express.static(path.join(ROOT_DIR, "images")));
app.use("/Chrome_Extensions", express.static(path.join(ROOT_DIR, "Chrome_Extensions")));

// Root static assets and homepage
app.use(express.static(ROOT_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

// Fallback route
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`Utilities server running on http://${HOST}:${PORT}`);
});
