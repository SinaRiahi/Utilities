function setStatus(text, isError = false) {
  const el = document.getElementById('status');
  el.innerText = text;
  el.style.color = isError ? '#ef4444' : '#10b981';
  setTimeout(() => {
    el.innerText = 'Ready.';
    el.style.color = '#6b7280';
  }, 3000);
}

const toggleEl = document.getElementById('toggle-active');

// Load initial state
chrome.storage.local.get(['isActive'], (res) => {
  toggleEl.checked = !!res.isActive;
});

// Watch toggle changes
toggleEl.addEventListener('change', (e) => {
  const isActive = e.target.checked;
  chrome.storage.local.set({ isActive }, () => {
    setStatus(isActive ? 'Auto-Fill Active' : 'Auto-Fill Paused');
  });
});

document.getElementById('btn-collect').addEventListener('click', async () => {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'collect' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('Please refresh the page.', true);
      } else {
        setStatus(response?.success ? `Copied ${response.count} fields!` : 'Failed to copy.', !response?.success);
      }
    });
  } catch (err) {
    setStatus('Error connecting to page.', true);
  }
});

document.getElementById('btn-fill').addEventListener('click', async () => {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'fill' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('Please refresh the page.', true);
      } else {
        setStatus(response?.success ? 'Fields filled!' : 'No data found.', !response?.success);
      }
    });
  } catch (err) {
    setStatus('Error connecting to page.', true);
  }
});
