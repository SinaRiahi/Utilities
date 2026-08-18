/**
 * Field Filler - Quill Content Script (v2.1.1)
 * Multi-Paradigm Form Automation Engine
 * Supports:
 * - Legacy Table-Based Forms (<tr><td>Label</td><td><input></td></tr>)
 * - Definition Lists (<dl><dt>Label</dt><dd><input></dd></dl>)
 * - Floating Labels & Post-Input Labels (Material UI, Bootstrap 5, Vuetify)
 * - Deep Container & Field Wrappers (.form-group, .ant-form-item, etc.)
 * - Machine-Generated ASP.NET / JSP / Oracle Form IDs (ctl00$txtItemTitle)
 * - ContentEditable & Rich Text Editors (Quill, TinyMCE, Draft.js, ProseMirror)
 * - Shadow DOM & Web Components Traversal
 * - Multi-Tier Fuzzy Signature Matching & Normalization
 * - Multi-Sheet Excel Iteration with React Synthetic Event Bypass
 */

// Safe check for valid Chrome extension context
function isExtensionValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Helper to bypass React's internal valueTracker across all input types
function setNativeValue(element, value) {
  if (!element || value === undefined || value === null) return;
  const strValue = String(value);

  try {
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
  } catch (err) {
    element.value = strValue;
  }
}

function setNativeChecked(element, checked) {
  if (!element) return;
  try {
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
  } catch (err) {
    element.checked = checked;
  }
}

// Clean and de-noise label strings
function cleanLabelText(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.replace(/\u00a0/g, ' '); // Replace non-breaking spaces
  // Strip noise: required/optional markers, colons, asterisks, question marks
  text = text
    .replace(/\s*\(\s*(required|optional|req|opt)\s*\)/gi, '')
    .replace(/\s*\[\s*(required|optional|req|opt)\s*\]/gi, '')
    .replace(/[*?:•]/g, '')
    .replace(/[:\-–—]+$/, '') // trailing colons or dashes
    .replace(/^\s*[:\-–—]+/, '') // leading colons or dashes
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 0 ? text : null;
}

// Clean machine-generated names/IDs (ASP.NET, JSP, Oracle, camelCase, snake_case)
function cleanMachineName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();

  // Strip common frameworks prefixes
  s = s.replace(/^(ctl00[$_]|cphMain[$_]|FormView\d*[$_]|zone\w*[$_]|zoneCenter[$_]|MainContent[$_])/i, '');
  s = s.replace(/^(txt|tb|ddl|cb|chk|rad|btn|sel|inp|input|field|fld|lbl|item)_+/i, '');
  s = s.replace(/^(txt|tb|ddl|cb|chk|rad|btn|sel|inp|input|field|fld|lbl|item)([A-Z])/i, '$2');

  // Strip trailing numeric indices e.g. _0, _ctl01, $0
  s = s.replace(/([$_]\d+)+$/, '');

  // Convert snake_case or kebab-case
  s = s.replace(/[-_]+/g, ' ');

  // Convert CamelCase into separate words: "ManufacturerPartNumber" -> "Manufacturer Part Number"
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 1 ? s : null;
}

// Recursively find elements including inside Shadow DOM roots
function deepQuerySelectorAll(root, selector) {
  const results = [];

  function traverse(node) {
    if (!node) return;
    try {
      if (node.querySelectorAll) {
        const matches = node.querySelectorAll(selector);
        for (let i = 0; i < matches.length; i++) {
          results.push(matches[i]);
        }
      }
      // Check Shadow DOM
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      // Check child elements for shadowRoot
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child && child.shadowRoot) {
            traverse(child.shadowRoot);
          }
        }
      }
    } catch (e) {}
  }

  traverse(root);
  return results;
}

// Extract the text of a node while stripping unwanted sub-elements (tooltips, icons, scripts, inputs)
function getSanitizedNodeText(node) {
  if (!node) return null;
  try {
    const clone = node.cloneNode(true);
    const junk = clone.querySelectorAll(
      'input, select, textarea, button, svg, script, style, .tooltip, .help-block, .info-icon, .popover, [class*="tooltip"], [class*="help"], [class*="badge"]'
    );
    junk.forEach((el) => {
      try {
        el.remove();
      } catch (e) {}
    });
    return cleanLabelText(clone.innerText || clone.textContent);
  } catch (e) {
    try {
      return cleanLabelText(node.innerText || node.textContent);
    } catch (err) {
      return null;
    }
  }
}

// Comprehensive Multi-Paradigm Field Signature Generator
function getFieldSignature(element) {
  if (!element) return null;

  // 1. Explicit <label for="id"> or <label for="name">
  if (element.id && typeof element.id === 'string' && element.id.trim()) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.id.trim())}"]`);
      const txt = getSanitizedNodeText(label);
      if (txt) return txt;
    } catch (e) {}
  }
  if (element.name && typeof element.name === 'string' && element.name.trim()) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.name.trim())}"]`);
      const txt = getSanitizedNodeText(label);
      if (txt) return txt;
    } catch (e) {}
  }

  // 2. Implicit Parent <label>
  try {
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const txt = getSanitizedNodeText(parentLabel);
      if (txt) return txt;
    }
  } catch (e) {}

  // 3. ARIA Labels
  try {
    const ariaLabel = cleanLabelText(element.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((id) => {
          const el = document.getElementById(id);
          return el ? getSanitizedNodeText(el) : null;
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
  } catch (e) {}

  // 4. Legacy Table-Based Layouts (Classic ERP, Seller Central Classic, ASP/JSP Forms)
  try {
    const cell = element.closest('td, th');
    if (cell) {
      // 4a. Check preceding cell in the same row: <tr><td class="label">Product Title:</td><td><input></td></tr>
      let prevCell = cell.previousElementSibling;
      while (prevCell) {
        const cellText = getSanitizedNodeText(prevCell);
        if (cellText) return cellText;
        prevCell = prevCell.previousElementSibling;
      }

      // 4b. Table Header matching (by column index): <thead><tr><th>SKU</th>...</tr></thead>
      const row = cell.closest('tr');
      const table = cell.closest('table');
      if (row && table && cell.cellIndex !== undefined) {
        const headerCell = table.querySelector(
          `thead tr th:nth-child(${cell.cellIndex + 1}), tr:first-child th:nth-child(${cell.cellIndex + 1})`
        );
        if (headerCell && headerCell !== cell) {
          const headerText = getSanitizedNodeText(headerCell);
          if (headerText) return headerText;
        }
      }

      // 4c. Previous row label if current row is inputs-only
      if (row && row.previousElementSibling) {
        const prevRowLabel = row.previousElementSibling.querySelector('td[colspan], th[colspan], td.label, th.label');
        if (prevRowLabel) {
          const txt = getSanitizedNodeText(prevRowLabel);
          if (txt) return txt;
        }
      }
    }
  } catch (e) {}

  // 5. Definition Lists (<dl><dt>Label</dt><dd><input></dd></dl>)
  try {
    const dd = element.closest('dd');
    if (dd) {
      let dt = dd.previousElementSibling;
      while (dt) {
        if (dt.tagName && dt.tagName.toLowerCase() === 'dt') {
          const txt = getSanitizedNodeText(dt);
          if (txt) return txt;
        }
        dt = dt.previousElementSibling;
      }
    }
  } catch (e) {}

  // 6. Floating Labels & Suffix Labels (Bootstrap 5, Material-UI, Tailwind Float, Vuetify)
  try {
    let nextEl = element.nextElementSibling;
    while (nextEl) {
      if (
        nextEl.tagName &&
        (nextEl.tagName.toLowerCase() === 'label' ||
          nextEl.classList.contains('floating-label') ||
          nextEl.classList.contains('form-label') ||
          nextEl.classList.contains('md-label') ||
          nextEl.classList.contains('label-text'))
      ) {
        const txt = getSanitizedNodeText(nextEl);
        if (txt) return txt;
      }
      nextEl = nextEl.nextElementSibling;
    }

    const floatingWrap = element.closest('.form-floating, .floating-label-wrap, .md-input-container, .form-group-float');
    if (floatingWrap) {
      const floatLabel = floatingWrap.querySelector('label, .floating-label, .md-label');
      if (floatLabel) {
        const txt = getSanitizedNodeText(floatLabel);
        if (txt) return txt;
      }
    }
  } catch (e) {}

  // 7. Preceding Sibling Label / Span / Paragraph
  try {
    let prevEl = element.previousElementSibling;
    while (prevEl) {
      if (
        prevEl.tagName &&
        (prevEl.tagName.toLowerCase() === 'label' ||
          prevEl.classList.contains('label') ||
          prevEl.classList.contains('form-label') ||
          prevEl.classList.contains('control-label') ||
          prevEl.classList.contains('field-label'))
      ) {
        const txt = getSanitizedNodeText(prevEl);
        if (txt) return txt;
      }
      prevEl = prevEl.previousElementSibling;
    }
  } catch (e) {}

  // 8. Closest Form Container / Field Wrapper (.form-group, .ant-form-item, .field-row, etc.)
  try {
    let container = element.parentElement;
    let depth = 0;
    while (container && depth < 4 && container.tagName && container.tagName.toLowerCase() !== 'form' && container.tagName.toLowerCase() !== 'body') {
      const labelCandidate = container.querySelector(
        'label, .control-label, .form-label, .field-label, .ant-form-item-label, [class*="label"], [class*="title"], [class*="header"], strong, b, h4, h5, h6'
      );
      if (labelCandidate && !labelCandidate.contains(element)) {
        const txt = getSanitizedNodeText(labelCandidate);
        if (txt) return txt;
      }
      container = container.parentElement;
      depth++;
    }
  } catch (e) {}

  // 9. Fieldset Legend
  try {
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        const legTxt = getSanitizedNodeText(legend);
        if (legTxt) {
          const sub = element.placeholder || cleanMachineName(element.name) || cleanMachineName(element.id);
          return sub ? `${legTxt} > ${sub}` : legTxt;
        }
      }
    }
  } catch (e) {}

  // 10. Placeholder, Title, or Data-Placeholder
  try {
    if (element.placeholder && cleanLabelText(element.placeholder)) {
      return cleanLabelText(element.placeholder);
    }
    const titleAttr = element.getAttribute('title') || element.getAttribute('data-placeholder');
    if (titleAttr && cleanLabelText(titleAttr)) {
      return cleanLabelText(titleAttr);
    }
  } catch (e) {}

  // 11. Clean Machine-Generated Name / ID Attribute
  if (element.name) {
    const cleaned = cleanMachineName(element.name);
    if (cleaned) return cleaned;
  }
  if (element.id) {
    const cleaned = cleanMachineName(element.id);
    if (cleaned) return cleaned;
  }

  return null;
}

// Find group name / header for radios / checkboxes
function getFieldGroupLabel(element) {
  try {
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      const legTxt = getSanitizedNodeText(legend);
      if (legTxt) return legTxt;
    }

    const cell = element.closest('td, th');
    if (cell) {
      let prevCell = cell.previousElementSibling;
      while (prevCell) {
        const txt = getSanitizedNodeText(prevCell);
        if (txt) return txt;
        prevCell = prevCell.previousElementSibling;
      }
    }

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3 && parent.tagName && parent.tagName.toLowerCase() !== 'body') {
      const header = parent.querySelector('label, .group-title, .form-label, span.font-semibold, h4, h5, p.font-bold, strong, b');
      if (header && !header.contains(element)) {
        const txt = getSanitizedNodeText(header);
        if (txt) return txt;
      }
      parent = parent.parentElement;
      depth++;
    }
  } catch (e) {}

  if (element.name) {
    const cleaned = cleanMachineName(element.name);
    if (cleaned) return cleaned;
  }

  return element.name || '';
}

// Scan & Collect All Form Fields across any page design
async function collectPageFields() {
  const inputs = deepQuerySelectorAll(
    document,
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [role="textbox"]'
  );
  const data = {};

  for (const input of inputs) {
    try {
      const isContentEditable = input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox';
      const sig = getFieldSignature(input);
      if (!sig) continue;

      if (isContentEditable) {
        const text = input.innerText || input.textContent || '';
        if (text.trim()) {
          data[sig] = { type: 'contenteditable', value: text.trim() };
        }
      } else if (input.tagName && input.tagName.toLowerCase() === 'select') {
        if (input.multiple) {
          const selectedValues = Array.from(input.selectedOptions || []).map((opt) => opt.value || opt.text);
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
          const radioOptionLabel = getSanitizedNodeText(input.closest('label')) || input.value || sig;

          data[sig] = {
            type: 'radio',
            group: groupLabel,
            name: input.name,
            value: input.value || radioOptionLabel,
            checked: true,
          };

          if (groupLabel && groupLabel !== sig) {
            data[groupLabel] = {
              type: 'radio',
              group: groupLabel,
              name: input.name,
              value: input.value || radioOptionLabel,
              checked: true,
            };
          }
        }
      } else if (input.type === 'file') {
        if (input.files && input.files.length > 0) {
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
        }
      } else if (input.value !== undefined && input.value !== '') {
        data[sig] = { type: input.type || 'text', value: input.value };
      }
    } catch (err) {}
  }

  return data;
}

// Multi-Tier Fuzzy Matcher between Template Fields & DOM Candidate Keys
function matchStoredField(mergedFields, candidateKeys) {
  const norm = (s) => (s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, '') : '');
  const tokenize = (s) => (s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 1) : []);

  const mergedKeys = Object.keys(mergedFields);

  // Tier 1: Exact Key Match
  for (const c of candidateKeys) {
    if (!c) continue;
    if (mergedFields[c]) return { stored: mergedFields[c], key: c };
  }

  // Tier 2: Normalized Alphanumeric Match
  for (const c of candidateKeys) {
    if (!c) continue;
    const cNorm = norm(c);
    if (!cNorm) continue;
    for (const mKey of mergedKeys) {
      if (norm(mKey) === cNorm) {
        return { stored: mergedFields[mKey], key: mKey };
      }
    }
  }

  // Tier 3: Token Overlap & Substring Match
  for (const c of candidateKeys) {
    if (!c) continue;
    const cTokens = tokenize(c);
    if (cTokens.length === 0) continue;

    for (const mKey of mergedKeys) {
      const mTokens = tokenize(mKey);
      if (mTokens.length === 0) continue;

      const candidateSubset = cTokens.every((t) => mTokens.includes(t));
      const templateSubset = mTokens.every((t) => cTokens.includes(t));

      if (candidateSubset || templateSubset) {
        return { stored: mergedFields[mKey], key: mKey };
      }
    }
  }

  return null;
}

// Populate Fields using Active Templates & Iteration Data
async function fillActiveTemplates(context = document) {
  return new Promise((resolve) => {
    if (!isExtensionValid()) {
      resolve({ success: false, count: 0, reason: 'extension_invalidated' });
      return;
    }

    try {
      chrome.storage.local.get(['templates'], async (res) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, count: 0, reason: chrome.runtime.lastError.message });
          return;
        }

        const templates = res?.templates || {};
        const activeTemplates = Object.values(templates).filter((t) => t.isActive);

        if (activeTemplates.length === 0) {
          resolve({ success: false, count: 0, reason: 'no_active_templates' });
          return;
        }

        const mergedFields = {};

        activeTemplates.forEach((t) => {
          const fieldKeys = Object.keys(t.fields || {});

          if (t.iterationMode && t.rows && t.rows.length > 0) {
            const rowIndex = Math.min(t.currentRowIndex || 0, t.rows.length - 1);
            const activeRow = t.rows[rowIndex] || {};

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
            Object.assign(mergedFields, t.fields);
          }
        });

        const inputs = deepQuerySelectorAll(
          context,
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [role="textbox"]'
        );

        let fillCount = 0;

        for (const input of inputs) {
          try {
            const isContentEditable = input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox';
            const sig = getFieldSignature(input);
            const groupLabel = getFieldGroupLabel(input);
            const nameAttr = cleanMachineName(input.name) || input.name;
            const idAttr = cleanMachineName(input.id) || input.id;

            const candidateKeys = [
              sig,
              groupLabel,
              nameAttr,
              input.name,
              idAttr,
              input.id,
              input.placeholder,
              input.getAttribute ? input.getAttribute('title') : null,
            ].filter(Boolean);

            const match = matchStoredField(mergedFields, candidateKeys);
            if (!match) continue;

            const stored = match.stored;
            const valToSet = stored.value;

            if (isContentEditable) {
              const str = String(valToSet);
              if (input.innerText !== str && input.innerHTML !== str) {
                input.innerText = str;
                input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
                input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
                fillCount++;
              }
            } else if (input.tagName && input.tagName.toLowerCase() === 'select') {
              if (input.multiple) {
                const items = String(valToSet)
                  .split(/[,|;]/)
                  .map((s) => s.trim().toLowerCase());
                let anySelected = false;
                Array.from(input.options || []).forEach((opt) => {
                  const matches =
                    items.includes(opt.value.toLowerCase().trim()) ||
                    items.includes(opt.text.toLowerCase().trim()) ||
                    items.some((i) => opt.text.toLowerCase().includes(i) || i.includes(opt.text.toLowerCase()));
                  opt.selected = matches;
                  if (matches) anySelected = true;
                });
                if (anySelected) {
                  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                  fillCount++;
                }
              } else {
                const targetVal = String(valToSet).trim().toLowerCase();
                let optionFound = false;
                Array.from(input.options || []).forEach((opt) => {
                  const optVal = opt.value.toLowerCase().trim();
                  const optTxt = opt.text.toLowerCase().trim();
                  if (optVal === targetVal || optTxt === targetVal || optTxt.includes(targetVal) || targetVal.includes(optTxt)) {
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
              const raw = String(valToSet).toLowerCase().trim();
              const shouldCheck =
                stored.checked === true ||
                raw === 'true' ||
                raw === '1' ||
                raw === 'yes' ||
                raw === 'on' ||
                raw === 'checked' ||
                raw === 'y' ||
                String(input.value).toLowerCase() === raw;

              if (shouldCheck && !input.checked) {
                setNativeChecked(input, true);
                fillCount++;
              } else if (!shouldCheck && (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') && input.checked) {
                setNativeChecked(input, false);
                fillCount++;
              }
            } else if (input.type === 'radio') {
              const rawVal = String(valToSet).toLowerCase().trim();
              const inputVal = String(input.value).toLowerCase().trim();
              const labelSig = (sig || '').toLowerCase().trim();
              const optLabel = (getSanitizedNodeText(input.closest('label')) || '').toLowerCase().trim();

              const shouldCheck =
                stored.checked === true ||
                rawVal === inputVal ||
                rawVal === labelSig ||
                rawVal === optLabel ||
                rawVal.includes(inputVal) ||
                rawVal.includes(optLabel) ||
                optLabel.includes(rawVal);

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
              } catch (err) {}
            } else if (input.type === 'range') {
              if (String(input.value) !== String(valToSet)) {
                setNativeValue(input, valToSet);
                fillCount++;
              }
            } else {
              if (String(input.value) !== String(valToSet)) {
                setNativeValue(input, valToSet);
                fillCount++;
              }
            }

            input.dataset.ffFilled = 'true';
          } catch (itemErr) {}
        }

        resolve({ success: fillCount > 0, count: fillCount });
      });
    } catch (outerErr) {
      resolve({ success: false, count: 0, reason: outerErr.message });
    }
  });
}

// Initial Auto-Fill Execution
setTimeout(() => {
  if (isExtensionValid()) {
    fillActiveTemplates();
  }
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
      if (isExtensionValid()) {
        fillActiveTemplates();
      }
    }, 300);
  }
});

function initObserver() {
  const targetNode = document.body || document.documentElement;
  if (targetNode) {
    try {
      observer.observe(targetNode, { childList: true, subtree: true });
    } catch (e) {}
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      const node = document.body || document.documentElement;
      if (node) {
        try {
          observer.observe(node, { childList: true, subtree: true });
        } catch (e) {}
      }
    });
  }
}

initObserver();

// Message Listeners from Popup
if (isExtensionValid()) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === 'collect') {
      collectPageFields()
        .then((data) => {
          sendResponse({ success: true, data, count: Object.keys(data).length });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message, data: {}, count: 0 });
        });
      return true; // Keep async channel open
    } else if (request.action === 'fill') {
      try {
        document.querySelectorAll('[data-ff-filled="true"]').forEach((el) => delete el.dataset.ffFilled);
      } catch (e) {}

      fillActiveTemplates()
        .then((res) => {
          sendResponse(res);
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message, count: 0 });
        });
      return true; // Keep async channel open
    }

    return false;
  });
}
