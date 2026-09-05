document.addEventListener('DOMContentLoaded', async () => {
    const btnScan = document.getElementById('btnScan');
    const btnExportJson = document.getElementById('btnExportJson');
    const btnExportSpec = document.getElementById('btnExportSpec');
    const btnInspect = document.getElementById('btnInspect');
    const btnInspectText = document.getElementById('btnInspectText');
    const statusMsg = document.getElementById('statusMsg');

    const statInputs = document.getElementById('statInputs');
    const statActions = document.getElementById('statActions');
    const statForms = document.getElementById('statForms');
    const statIframes = document.getElementById('statIframes');

    function setStatus(msg) {
        statusMsg.textContent = msg;
        setTimeout(() => {
            if (statusMsg.textContent === msg) {
                statusMsg.textContent = '';
            }
        }, 3500);
    }

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Ensure content script & CSS are injected
    async function ensureInjected(tabId) {
        return new Promise((resolve) => {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }, () => {
                chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['content.css']
                }, () => resolve(true));
            });
        });
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Initialize quick stats from current page
    async function refreshPageStats() {
        const tab = await getActiveTab();
        if (!tab || !tab.id || tab.url?.startsWith('chrome://')) {
            statInputs.textContent = '-';
            statActions.textContent = '-';
            statForms.textContent = '-';
            statIframes.textContent = '-';
            return;
        }

        try {
            await ensureInjected(tab.id);
            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.success && response.data?.metrics) {
                    const m = response.data.metrics;
                    statInputs.textContent = m.inputs;
                    statActions.textContent = m.actions;
                    statForms.textContent = m.forms;
                    statIframes.textContent = m.iframes;
                }
            });
        } catch {
            // Ignored if restricted tab
        }
    }

    refreshPageStats();

    // 1. Scan Page & Download Markdown Dossier
    btnScan.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;

        setStatus("Analyzing page structure...");
        await ensureInjected(tab.id);

        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (response && response.success && response.data) {
                const safeTitle = (response.data.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                downloadFile(response.data.markdown, `AutoScope_${safeTitle}_Automation_Dossier.md`, 'text/markdown');
                setStatus(`✅ Extracted ${response.data.count} elements. Downloaded MD.`);
            } else {
                setStatus("❌ Failed to scan page.");
            }
        });
    });

    // 2. Export JSON Spec
    btnExportJson.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;

        setStatus("Generating JSON Spec...");
        await ensureInjected(tab.id);

        chrome.tabs.sendMessage(tab.id, { action: "exportArtifact", format: "json" }, (response) => {
            if (response && response.success) {
                downloadFile(response.content, response.filename, response.mimeType);
                setStatus("✅ Downloaded Automation Spec (.json)");
            } else {
                setStatus("❌ Failed to export JSON.");
            }
        });
    });

    // 3. Export Playwright Test (.spec.ts)
    btnExportSpec.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;

        setStatus("Scaffolding Playwright Test...");
        await ensureInjected(tab.id);

        chrome.tabs.sendMessage(tab.id, { action: "exportArtifact", format: "spec-ts" }, (response) => {
            if (response && response.success) {
                downloadFile(response.content, response.filename, response.mimeType);
                setStatus("✅ Downloaded Playwright Test (.spec.ts)");
            } else {
                setStatus("❌ Failed to scaffold test.");
            }
        });
    });

    // 4. Toggle In-Page HUD & Inspector Mode
    btnInspect.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;

        await ensureInjected(tab.id);
        chrome.tabs.sendMessage(tab.id, { action: "toggleInspect" }, (response) => {
            if (response && response.active) {
                btnInspect.classList.add('active');
                btnInspectText.textContent = "🛑 Close In-Page HUD";
                setStatus("In-page HUD & Inspector active.");
            } else {
                btnInspect.classList.remove('active');
                btnInspectText.textContent = "🎯 Launch In-Page HUD & Inspector";
                setStatus("In-page HUD closed.");
            }
        });
    });
});
