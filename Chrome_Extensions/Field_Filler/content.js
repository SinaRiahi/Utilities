/**
 * Field Filler - Quill Content Script (v2.0)
 * Context-Aware Matching, Multi-Selects, React Synthetic Event Bypass, and Excel Iteration Engine
 */

// Helper to bypass React's internal valueTracker
function setNativeValue(element, value) {
  if (value === undefined || value === null) return;
  const strValue = String(value);

  let prototype = Object.getPrototypeOf(element);
  while (prototype && !Object.prototype.hasOwnProperty.call(prototype, 'value')) {
    prototype = Object.getPrototypeOf(prototype);
  }
  const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, strValue);
  } else {
    element.value = strValue;
  }

  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true, composed: true }));
}

function setNativeChecked(element, checked) {
  let prototype = Object.getPrototypeOf(element);
  while (prototype && !Object.prototype.hasOwnProperty.call(prototype, 'checked')) {
    prototype = Object.getPrototypeOf(prototype);
  }
  const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'checked') : null;
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, checked);
  } else {
    element.checked = checked;
  }

  element.dispatchEvent(new Event('click', { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
}

// Generate Robust Context-Aware Signature
function getFieldSignature(element) {
  // 1. Explicit <label for="id">
  if (element.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label && label.innerText && label.innerText.trim()) {
        return label.innerText.trim();
      }
    } catch (e) {}
  }

  // 2. Implicit Parent <label>
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach((i) => i.remove());
    const text = clone.innerText.trim();
    if (text) return text;
  }

  // 3. Fieldset Legend
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend && legend.innerText.trim()) {
      const baseLabel = element.name || element.placeholder || element.getAttribute('aria-label');
      if (baseLabel) return `${legend.innerText.trim()} > ${baseLabel.trim()}`;
    }
  }

  // 4. aria-label or aria-labelledby
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label').trim();
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    try {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
    } catch (e) {}
  }

  // 5. Placeholder
  if (element.placeholder && element.placeholder.trim()) {
    return element.placeholder.trim();
  }

  // 6. Name attribute
  if (element.name && element.name.trim()) {
    return element.name.trim();
  }

  // 7. Preceding text / label sibling
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.tagName && (prev.tagName.toLowerCase() === 'label' || prev.classList.contains('label'))) {
      if (prev.innerText && prev.innerText.trim()) return prev.innerText.trim();
    }
    prev = prev.previousElementSibling;
  }

  return null;
}

// Find group name / header for radios / checkboxes
function getFieldGroupLabel(element) {
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend && legend.innerText.trim()) return legend.innerText.trim();
  }

  // Check preceding span/label/div header in parent container
  const parent = element.closest('div');
  if (parent) {
    const header = parent.querySelector('span, label, p, h4, h5');
    if (header && header.innerText.trim()) {
      return header.innerText.trim();
    }
  }

  return element.name || '';
}

// Scan & Collect All Form Fields on the Page
async function collectPageFields() {
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
  );
  const data = {};

  for (const input of Array.from(inputs)) {
    const sig = getFieldSignature(input);
    if (!sig) continue;

    if (input.tagName.toLowerCase() === 'select') {
      if (input.multiple) {
        // Multi-select dropdown
        const selectedValues = Array.from(input.selectedOptions).map((opt) => opt.value || opt.text);
        data[sig] = { type: 'select-multiple', value: selectedValues.join(', ') };
      } else {
        data[sig] = { type: 'select', value: input.value };
      }
    } else if (input.type === 'checkbox') {
      if (input.checked) {
        data[sig] = { type: 'checkbox', value: input.value || 'on', checked: true };
      }
    } else if (input.type === 'radio') {
      if (input.checked) {
        const groupLabel = getFieldGroupLabel(input);
        data[sig] = {
          type: 'radio',
          group: groupLabel,
          name: input.name,
          value: input.value || sig,
          checked: true,
        };
        // Also capture under group name if distinct
        if (groupLabel && groupLabel !== sig) {
          data[groupLabel] = {
            type: 'radio',
            group: groupLabel,
            name: input.name,
            value: input.value || sig,
            checked: true,
          };
        }
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
    } else if (input.value !== undefined && input.value !== '') {
      data[sig] = { type: input.type || 'text', value: input.value };
    }
  }

  return data;
}

// Populate Fields using Active Templates & Iteration Data
async function fillActiveTemplates(context = document) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['templates'], async (res) => {
      const templates = res.templates || {};
      const activeTemplates = Object.values(templates).filter((t) => t.isActive);

      if (activeTemplates.length === 0) {
        resolve({ success: false, count: 0, reason: 'no_active_templates' });
        return;
      }

      // Consolidate dataset from all active templates
      const mergedFields = {};

      activeTemplates.forEach((t) => {
        const fieldKeys = Object.keys(t.fields || {});

        if (t.iterationMode && t.rows && t.rows.length > 0) {
          const rowIndex = Math.min(t.currentRowIndex || 0, t.rows.length - 1);
          const activeRow = t.rows[rowIndex] || {};

          // Add active row columns
          Object.keys(activeRow).forEach((col) => {
            const val = activeRow[col];
            if (val !== undefined && val !== null && val !== '') {
              mergedFields[col] = {
                type: 'text',
                value: val,
                checked: val === true || val === 'true' || val === 'on' || val === 1,
              };
            }
          });

          // Overlay baseline fields
          fieldKeys.forEach((key) => {
            const rowVal = activeRow[key];
            if (rowVal !== undefined && rowVal !== null && rowVal !== '') {
              mergedFields[key] = {
                type: t.fields[key]?.type || 'text',
                value: rowVal,
                checked: rowVal === true || rowVal === 'true' || rowVal === 'on' || rowVal === 1,
              };
            } else if (!mergedFields[key] && t.fields[key]) {
              mergedFields[key] = t.fields[key];
            }
          });
        } else {
          // Standard baseline fields
          Object.assign(mergedFields, t.fields);
        }
      });

      const inputs = context.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
      );

      let fillCount = 0;

      for (const input of inputs) {
        const sig = getFieldSignature(input);
        const groupLabel = getFieldGroupLabel(input);
        const nameAttr = input.name;

        // Try to find matching value by signature, group label, or name
        let stored = null;
        let matchedKey = null;

        const candidateKeys = [sig, groupLabel, nameAttr, input.placeholder, input.id].filter(Boolean);

        for (const candidate of candidateKeys) {
          if (mergedFields[candidate]) {
            stored = mergedFields[candidate];
            matchedKey = candidate;
            break;
          }
          // Case-insensitive / whitespace trimmed fallback match
          const normalized = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
          const foundKey = Object.keys(mergedFields).find(
            (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
          );
          if (foundKey) {
            stored = mergedFields[foundKey];
            matchedKey = foundKey;
            break;
          }
        }

        if (!stored) continue;

        const valToSet = stored.value;

        if (input.tagName.toLowerCase() === 'select') {
          if (input.multiple) {
            // Multi-select dropdown
            const items = String(valToSet)
              .split(/[,|]/)
              .map((s) => s.trim().toLowerCase());
            let anySelected = false;
            Array.from(input.options).forEach((opt) => {
              const matches = items.includes(opt.value.toLowerCase()) || items.includes(opt.text.toLowerCase());
              opt.selected = matches;
              if (matches) anySelected = true;
            });
            if (anySelected) {
              input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              fillCount++;
            }
          } else {
            // Single select
            const targetVal = String(valToSet).trim().toLowerCase();
            let optionFound = false;
            Array.from(input.options).forEach((opt) => {
              if (opt.value.toLowerCase() === targetVal || opt.text.trim().toLowerCase() === targetVal) {
                input.value = opt.value;
                optionFound = true;
              }
            });
            if (!optionFound) {
              input.value = String(valToSet);
            }
            input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            fillCount++;
          }
        } else if (input.type === 'checkbox') {
          const shouldCheck =
            stored.checked ||
            valToSet === true ||
            valToSet === 'true' ||
            valToSet === '1' ||
            String(input.value).toLowerCase() === String(valToSet).toLowerCase();

          if (shouldCheck && !input.checked) {
            setNativeChecked(input, true);
            fillCount++;
          }
        } else if (input.type === 'radio') {
          const rawVal = String(valToSet).toLowerCase().trim();
          const inputVal = String(input.value).toLowerCase().trim();
          const labelSig = (sig || '').toLowerCase().trim();

          const shouldCheck =
            stored.checked ||
            rawVal === inputVal ||
            rawVal === labelSig ||
            rawVal.includes(inputVal) ||
            rawVal.includes(labelSig);

          if (shouldCheck && !input.checked) {
            setNativeChecked(input, true);
            fillCount++;
          }
        } else if (input.type === 'file' && stored.type === 'file' && stored.dataUrl) {
          try {
            const fetchRes = await fetch(stored.dataUrl);
            const blob = await fetchRes.blob();
            const file = new File([blob], stored.fileName || 'uploaded-file.png', {
              type: stored.mimeType || 'image/png',
            });
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            fillCount++;
          } catch (err) {
            console.error('Field Filler: Failed to re-inject file:', err);
          }
        } else {
          // Standard text, number, date, textarea, etc.
          if (String(input.value) !== String(valToSet)) {
            setNativeValue(input, valToSet);
            fillCount++;
          }
        }

        input.dataset.ffFilled = 'true';
      }

      resolve({ success: fillCount > 0, count: fillCount });
    });
  });
}

// Initial Auto-Fill Execution
setTimeout(() => {
  fillActiveTemplates();
}, 400);

// Debounced MutationObserver for Dynamic SPA / React Wizards
let fillTimeout = null;
const observer = new MutationObserver((mutations) => {
  let hasNewInputs = false;
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length > 0) {
      hasNewInputs = true;
      break;
    }
  }

  if (hasNewInputs) {
    if (fillTimeout) clearTimeout(fillTimeout);
    fillTimeout = setTimeout(() => {
      fillActiveTemplates();
    }, 300);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Message Listeners from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collect') {
    collectPageFields().then((data) => {
      sendResponse({ success: true, data, count: Object.keys(data).length });
    });
    return true; // Keep async channel open
  } else if (request.action === 'fill') {
    document.querySelectorAll('[data-ff-filled="true"]').forEach((el) => delete el.dataset.ffFilled);
    fillActiveTemplates().then((res) => {
      sendResponse(res);
    });
    return true; // Keep async channel open
  }
});
