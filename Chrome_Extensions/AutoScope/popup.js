document.addEventListener('DOMContentLoaded', () => {
    const btnScan = document.getElementById('btnScan');
    const btnInspect = document.getElementById('btnInspect');
    const statusMsg = document.getElementById('statusMsg');

    function setStatus(msg) {
        statusMsg.textContent = msg;
        setTimeout(() => { statusMsg.textContent = ''; }, 3000);
    }

    // Ensure content script is injected
    async function injectContentScript(tabId) {
        return new Promise((resolve) => {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }, () => {
                chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['content.css']
                }, resolve);
            });
        });
    }

    btnScan.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        
        await injectContentScript(tab.id);
        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (response && response.success) {
                setStatus("✅ Page scanned! Data copied to clipboard.");
            } else {
                setStatus("❌ Failed to scan page.");
            }
        });
    });

    btnInspect.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        
        await injectContentScript(tab.id);
        chrome.tabs.sendMessage(tab.id, { action: "toggleInspect" }, (response) => {
            if (response && response.active) {
                btnInspect.textContent = "🛑 Stop Inspect Mode";
                setStatus("Inspect mode activated.");
            } else {
                btnInspect.textContent = "🔍 Toggle Inspect Mode";
                setStatus("Inspect mode deactivated.");
            }
        });
    });
});
