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
        
        setStatus("Scanning...");
        await injectContentScript(tab.id);
        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (response && response.success && response.data) {
                // Create and download Markdown file
                const blob = new Blob([response.data.markdown], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const filename = response.data.title ? response.data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'page';
                a.download = `AutoScope_${filename}.md`;
                
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                setStatus(`✅ Scanned ${response.data.count} elements. Downloaded MD.`);
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
