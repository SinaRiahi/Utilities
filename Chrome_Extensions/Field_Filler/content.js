// Field Filler Content Script
// Context-Aware Field Identification Engine & Data Transfer API

// Hack to properly trigger React state updates
function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function getFieldSignature(element) {
  // 1. Explicit label
  if (element.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label && label.innerText) return label.innerText.trim();
    } catch(e) {} // Ignore malformed IDs
  }
  
  // 2. Implicit label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach(i => i.remove());
    const text = clone.innerText.trim();
    if (text) return text;
  }
  
  // 3. aria-label
  if (element.getAttribute('aria-label')) return element.getAttribute('aria-label').trim();
  
  // 4. Placeholder
  if (element.placeholder) return element.placeholder.trim();
  
  // 5. Name attribute
  if (element.name) return element.name;
  
  // 6. Preceding Text Node
  let prev = element.previousSibling;
  while (prev) {
    if (prev.nodeType === Node.TEXT_NODE && prev.textContent.trim()) {
      return prev.textContent.trim();
    }
    prev = prev.previousSibling;
  }
  
  return null;
}

async function collectFields() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
  const data = {};
  
  const promises = Array.from(inputs).map(async (input) => {
    const sig = getFieldSignature(input);
    if (!sig) return;

    if (input.type === 'checkbox' || input.type === 'radio') {
      if (input.checked) {
        data[sig] = { type: input.type, value: input.value, checked: true };
      }
    } else if (input.type === 'file' && input.files.length > 0) {
      const file = input.files[0];
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        data[sig] = { type: 'file', fileName: file.name, mimeType: file.type, dataUrl };
      }
    } else if (input.value) {
      data[sig] = { type: input.type, value: input.value };
    }
  });
  
  await Promise.all(promises);
  return data;
}

async function fillFields(data, context = document) {
  const inputs = context.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
  
  for (const input of inputs) {
    if (input.dataset.ffFilled === "true") continue; // Prevent endless refilling

    const sig = getFieldSignature(input);
    if (sig && data[sig]) {
      const stored = data[sig];
      
      if (input.type === 'checkbox' || input.type === 'radio') {
        if (stored.checked && input.value === stored.value && !input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dataset.ffFilled = "true";
        }
      } else if (input.type === 'file' && stored.type === 'file') {
        try {
          const res = await fetch(stored.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], stored.fileName, { type: stored.mimeType });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dataset.ffFilled = "true";
        } catch (err) {
          console.error('Field Filler: Failed to inject file:', err);
        }
      } else {
        if (input.value !== stored.value) {
          setNativeValue(input, stored.value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dataset.ffFilled = "true";
        }
      }
    }
  }
}

// 1. Initial Fill on load
function attemptAutoFill() {
  chrome.storage.local.get(['savedFields', 'isActive'], (res) => {
    if (res.isActive && res.savedFields) {
      fillFields(res.savedFields);
    }
  });
}
attemptAutoFill();

// 2. MutationObserver for dynamic React/SPA elements
const observer = new MutationObserver((mutations) => {
  chrome.storage.local.get(['savedFields', 'isActive'], (res) => {
    if (!res.isActive || !res.savedFields) return;
    
    let shouldFill = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldFill = true;
        break;
      }
    }
    if (shouldFill) {
      fillFields(res.savedFields);
    }
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// 3. Manual Triggers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collect') {
    collectFields().then((data) => {
      chrome.storage.local.get(['savedFields'], (res) => {
        const existing = res.savedFields || {};
        const merged = { ...existing, ...data };
        chrome.storage.local.set({ savedFields: merged }, () => {
          sendResponse({ success: true, count: Object.keys(data).length });
        });
      });
    });
    return true; 
  } else if (request.action === 'fill') {
    chrome.storage.local.get(['savedFields'], (res) => {
      if (res.savedFields) {
        // Clear filled markers to allow manual re-fill
        document.querySelectorAll('[data-ff-filled="true"]').forEach(el => delete el.dataset.ffFilled);
        fillFields(res.savedFields).then(() => sendResponse({ success: true }));
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
});
