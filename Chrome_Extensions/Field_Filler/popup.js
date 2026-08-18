/**
 * Field Filler - Quill Edition (v2.1.1)
 * Multi-Template, Multi-Sheet Excel Automation Controller
 */

// Storage Helpers
async function getStorage() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['templates', 'activeTemplateId'], (res) => {
        if (chrome.runtime.lastError) {
          console.warn('Field Filler: Storage read error suppressed:', chrome.runtime.lastError);
          resolve({ templates: {}, activeTemplateId: null });
          return;
        }
        resolve({
          templates: res?.templates || {},
          activeTemplateId: res?.activeTemplateId || null,
        });
      });
    } catch (e) {
      resolve({ templates: {}, activeTemplateId: null });
    }
  });
}

async function saveStorage(data) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.warn('Field Filler: Storage write error suppressed:', chrome.runtime.lastError);
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

// UI Status Display
function setStatus(text, type = 'normal') {
  const dot = document.getElementById('status-icon');
  const label = document.getElementById('status-text');
  if (!label || !dot) return;

  label.innerText = text;
  dot.className = 'status-dot';
  if (type === 'warning') dot.classList.add('warning');
  if (type === 'error') dot.classList.add('error');

  setTimeout(() => {
    label.innerText = 'Ready';
    dot.className = 'status-dot';
  }, 4000);
}

// Render Templates UI
async function renderTemplates() {
  const { templates } = await getStorage();
  const listEl = document.getElementById('templates-list');
  const emptyEl = document.getElementById('empty-state');
  const countEl = document.getElementById('template-count');

  if (!listEl || !emptyEl || !countEl) return;

  const templateIds = Object.keys(templates);
  countEl.innerText = templateIds.length;

  if (templateIds.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  templateIds.forEach((id) => {
    const t = templates[id];
    if (!t) return;
    const fieldCount = Object.keys(t.fields || {}).length;
    const rowCount = (t.rows && t.rows.length) || 0;
    const currRow = (t.currentRowIndex || 0) + 1;

    const card = document.createElement('div');
    card.className = `template-card ${t.isActive ? 'active-card' : ''}`;
    card.dataset.id = id;

    card.innerHTML = `
      <div class="template-card-top">
        <span class="template-name" title="${t.name}">${t.name}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="template-badge">${fieldCount} fields</span>
          ${rowCount > 0 ? `<span class="template-badge" style="background:#dcfce7;color:#15803d;">${rowCount} rows</span>` : ''}
        </div>
      </div>

      <div class="template-controls">
        <!-- Active Switch -->
        <div class="toggle-group">
          <label class="switch-sm">
            <input type="checkbox" class="toggle-template-active" data-id="${id}" ${t.isActive ? 'checked' : ''} />
            <span class="slider-sm"></span>
          </label>
          <span class="toggle-tag">Active</span>
        </div>

        <!-- Iteration Switch -->
        <div class="toggle-group">
          <label class="switch-sm">
            <input type="checkbox" class="toggle-template-iteration" data-id="${id}" ${t.iterationMode ? 'checked' : ''} />
            <span class="slider-sm slider-green"></span>
          </label>
          <span class="toggle-tag iteration">Iterate</span>
        </div>

        <!-- Action Buttons -->
        <div class="card-actions">
          <button class="btn-icon btn-update-template" data-id="${id}" title="Re-record from current page">⟳</button>
          <button class="btn-icon danger btn-delete-template" data-id="${id}" title="Delete template">✕</button>
        </div>
      </div>

      ${
        t.iterationMode && rowCount > 0
          ? `
        <div class="iteration-row-bar">
          <span class="row-counter">Row: ${currRow} / ${rowCount}</span>
          <div style="display: flex; gap: 4px;">
            <button class="stepper-btn btn-prev-row" data-id="${id}" ${t.currentRowIndex <= 0 ? 'disabled' : ''}>◀</button>
            <button class="stepper-btn btn-next-row" data-id="${id}" ${t.currentRowIndex >= rowCount - 1 ? 'disabled' : ''}>▶</button>
            <button class="stepper-btn btn-reset-row" data-id="${id}">↺ 1</button>
          </div>
        </div>
      `
          : ''
      }
    `;

    listEl.appendChild(card);
  });

  attachCardEvents();
}

// Event Listeners for Dynamic Cards
function attachCardEvents() {
  // Toggle Active
  document.querySelectorAll('.toggle-template-active').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const { templates } = await getStorage();
      if (templates[id]) {
        templates[id].isActive = e.target.checked;
        await saveStorage({ templates });
        setStatus(`Template "${templates[id].name}" ${e.target.checked ? 'activated' : 'paused'}`);
        renderTemplates();
      }
    });
  });

  // Toggle Iteration Mode
  document.querySelectorAll('.toggle-template-iteration').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const { templates } = await getStorage();
      if (templates[id]) {
        templates[id].iterationMode = e.target.checked;
        await saveStorage({ templates });
        setStatus(`Iteration Mode ${e.target.checked ? 'ON' : 'OFF'} for ${templates[id].name}`);
        renderTemplates();
      }
    });
  });

  // Update / Re-record template from current page
  document.querySelectorAll('.btn-update-template').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      await recordCurrentPage(id);
    });
  });

  // Delete Template
  document.querySelectorAll('.btn-delete-template').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const { templates } = await getStorage();
      if (templates[id]) {
        const name = templates[id].name;
        delete templates[id];
        await saveStorage({ templates });
        setStatus(`Deleted "${name}"`);
        renderTemplates();
      }
    });
  });

  // Row Steppers
  document.querySelectorAll('.btn-prev-row').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const { templates } = await getStorage();
      if (templates[id] && templates[id].currentRowIndex > 0) {
        templates[id].currentRowIndex -= 1;
        await saveStorage({ templates });
        renderTemplates();
      }
    });
  });

  document.querySelectorAll('.btn-next-row').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const { templates } = await getStorage();
      const rows = templates[id]?.rows || [];
      if (templates[id] && templates[id].currentRowIndex < rows.length - 1) {
        templates[id].currentRowIndex += 1;
        await saveStorage({ templates });
        renderTemplates();
      }
    });
  });

  document.querySelectorAll('.btn-reset-row').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const { templates } = await getStorage();
      if (templates[id]) {
        templates[id].currentRowIndex = 0;
        await saveStorage({ templates });
        renderTemplates();
      }
    });
  });
}

// In-Frame Collector Function for chrome.scripting.executeScript
function inPageCollectFields() {
  function cleanLabelText(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let text = raw.replace(/\u00a0/g, ' ');
    text = text
      .replace(/\s*\(\s*(required|optional|req|opt)\s*\)/gi, '')
      .replace(/\s*\[\s*(required|optional|req|opt)\s*\]/gi, '')
      .replace(/[*?:•]/g, '')
      .replace(/[:\-–—]+$/, '')
      .replace(/^\s*[:\-–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 0 ? text : null;
  }

  function cleanMachineName(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    s = s.replace(/^(ctl00[$_]|cphMain[$_]|FormView\d*[$_]|zone\w*[$_]|zoneCenter[$_]|MainContent[$_])/i, '');
    s = s.replace(/^(txt|tb|ddl|cb|chk|rad|btn|sel|inp|input|field|fld|lbl|item)_+/i, '');
    s = s.replace(/^(txt|tb|ddl|cb|chk|rad|btn|sel|inp|input|field|fld|lbl|item)([A-Z])/i, '$2');
    s = s.replace(/([$_]\d+)+$/, '');
    s = s.replace(/[-_]+/g, ' ');
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > 1 ? s : null;
  }

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
        if (node.shadowRoot) traverse(node.shadowRoot);
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            if (child && child.shadowRoot) traverse(child.shadowRoot);
          }
        }
      } catch (e) {}
    }
    traverse(root);
    return results;
  }

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

    // 4. Legacy Table Layouts
    try {
      const cell = element.closest('td, th');
      if (cell) {
        let prevCell = cell.previousElementSibling;
        while (prevCell) {
          const cellText = getSanitizedNodeText(prevCell);
          if (cellText) return cellText;
          prevCell = prevCell.previousElementSibling;
        }
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
        if (row && row.previousElementSibling) {
          const prevRowLabel = row.previousElementSibling.querySelector('td[colspan], th[colspan], td.label, th.label');
          if (prevRowLabel) {
            const txt = getSanitizedNodeText(prevRowLabel);
            if (txt) return txt;
          }
        }
      }
    } catch (e) {}

    // 5. Definition Lists
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

    // 6. Floating & Suffix Labels
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

    // 7. Preceding Sibling Label
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

    // 8. Form Group Container Headers
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

    // 10. Placeholder / Title
    try {
      if (element.placeholder && cleanLabelText(element.placeholder)) {
        return cleanLabelText(element.placeholder);
      }
      const titleAttr = element.getAttribute('title') || element.getAttribute('data-placeholder');
      if (titleAttr && cleanLabelText(titleAttr)) {
        return cleanLabelText(titleAttr);
      }
    } catch (e) {}

    // 11. Clean Machine-Generated Name/ID
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
      } else if (input.value !== undefined && input.value !== '') {
        data[sig] = { type: input.type || 'text', value: input.value };
      }
    } catch (err) {}
  }

  return data;
}

// Record Form Fields from Active Tab across all frames
async function recordCurrentPage(targetTemplateId = null) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus('No active browser tab found', 'error');
      return;
    }

    // Check if URL is an internal browser page
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
      setStatus('Cannot record browser internal pages. Please open a website or web form.', 'warning');
      return;
    }

    let collectedData = {};

    // 1. Try direct execution with executeScript
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: inPageCollectFields,
      });

      if (results && results.length > 0) {
        results.forEach((r) => {
          if (r.result && Object.keys(r.result).length > 0) {
            Object.assign(collectedData, r.result);
          }
        });
      }
    } catch (scriptErr) {
      // Suppress script error and fall back to sendMessage
    }

    // 2. Fallback to sendMessage if executeScript didn't yield fields
    if (Object.keys(collectedData).length === 0) {
      const resp = await new Promise((resolve) => {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'collect' }, (r) => {
            const err = chrome.runtime.lastError; // Accessing suppresses unchecked runtime.lastError
            resolve(r || null);
          });
        } catch (msgErr) {
          resolve(null);
        }
      });
      if (resp && resp.data) {
        collectedData = resp.data;
      }
    }

    const fieldCount = Object.keys(collectedData).length;
    if (fieldCount === 0) {
      setStatus('No form fields detected on this page.', 'warning');
      return;
    }

    const { templates } = await getStorage();
    let templateName = '';

    if (targetTemplateId && templates[targetTemplateId]) {
      templates[targetTemplateId].fields = {
        ...(templates[targetTemplateId].fields || {}),
        ...collectedData,
      };
      templates[targetTemplateId].updatedAt = Date.now();
      templateName = templates[targetTemplateId].name;
    } else {
      const nameInput = document.getElementById('new-template-name');
      const customName = nameInput ? nameInput.value.trim() : '';
      templateName = customName || `Page ${Object.keys(templates).length + 1}`;
      const newId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      const initialRow = {};
      Object.keys(collectedData).forEach((sig) => {
        initialRow[sig] = collectedData[sig].value ?? '';
      });

      templates[newId] = {
        id: newId,
        name: templateName,
        isActive: true,
        iterationMode: false,
        currentRowIndex: 0,
        fields: collectedData,
        rows: [initialRow],
        updatedAt: Date.now(),
      };

      if (nameInput) nameInput.value = '';
    }

    await saveStorage({ templates });
    setStatus(`Recorded ${fieldCount} fields into "${templateName}"!`);
    renderTemplates();
  } catch (err) {
    console.error('Field Filler capture error:', err);
    setStatus('Could not record page fields', 'error');
  }
}

// Export All Templates to Multi-Sheet Excel (.xlsx)
async function exportToExcel() {
  const { templates } = await getStorage();
  const templateIds = Object.keys(templates);

  if (templateIds.length === 0) {
    setStatus('No templates available to export!', 'warning');
    return;
  }

  if (typeof XLSX === 'undefined') {
    setStatus('Excel library is loading...', 'warning');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    templateIds.forEach((id) => {
      const t = templates[id];
      const fieldKeys = Object.keys(t.fields || {});

      let sheetData = [];

      if (t.rows && t.rows.length > 0) {
        sheetData = t.rows.map((row) => {
          const cleanRow = {};
          fieldKeys.forEach((key) => {
            cleanRow[key] = row[key] ?? t.fields[key]?.value ?? '';
          });
          return cleanRow;
        });
      } else {
        const baseRow = {};
        fieldKeys.forEach((key) => {
          baseRow[key] = t.fields[key]?.value ?? '';
        });
        sheetData = [baseRow];
      }

      const ws = XLSX.utils.json_to_sheet(sheetData);

      let cleanSheetName = t.name.replace(/[/\\?*:[\]]/g, '_').substring(0, 31);
      if (!cleanSheetName) cleanSheetName = 'Sheet';

      let finalSheetName = cleanSheetName;
      let counter = 1;
      while (wb.SheetNames.includes(finalSheetName)) {
        finalSheetName = `${cleanSheetName.substring(0, 28)}_${counter++}`;
      }

      XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    XLSX.writeFile(wb, `Field_Filler_Templates_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setStatus('Exported multi-sheet Excel file!');
  } catch (err) {
    console.error('Excel Export Error:', err);
    setStatus('Export failed', 'error');
  }
}

// Import Multi-Sheet Excel (.xlsx)
async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    setStatus('Excel library not loaded', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const { templates } = await getStorage();

      let importedSheetCount = 0;
      let totalRowsCount = 0;

      workbook.SheetNames.forEach((sheetName) => {
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) return;

        let matchedId = Object.keys(templates).find(
          (id) => templates[id].name.toLowerCase().trim() === sheetName.toLowerCase().trim()
        );

        if (matchedId) {
          templates[matchedId].rows = rows;
          templates[matchedId].iterationMode = true;
          templates[matchedId].currentRowIndex = 0;
          importedSheetCount++;
          totalRowsCount += rows.length;
        } else {
          const newId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const sampleRow = rows[0] || {};
          const fields = {};

          Object.keys(sampleRow).forEach((colName) => {
            fields[colName] = { type: 'text', value: sampleRow[colName] };
          });

          templates[newId] = {
            id: newId,
            name: sheetName,
            isActive: true,
            iterationMode: true,
            currentRowIndex: 0,
            fields: fields,
            rows: rows,
            updatedAt: Date.now(),
          };
          importedSheetCount++;
          totalRowsCount += rows.length;
        }
      });

      await saveStorage({ templates });
      setStatus(`Imported ${totalRowsCount} rows across ${importedSheetCount} sheets!`);
      renderTemplates();
    } catch (err) {
      console.error(err);
      setStatus('Failed to parse Excel file', 'error');
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

// Global Step All Active Templates
async function stepAllRows(direction = 1) {
  const { templates } = await getStorage();
  let modified = false;

  Object.keys(templates).forEach((id) => {
    const t = templates[id];
    if (t.isActive && t.iterationMode && t.rows && t.rows.length > 0) {
      const nextIndex = (t.currentRowIndex || 0) + direction;
      if (nextIndex >= 0 && nextIndex < t.rows.length) {
        t.currentRowIndex = nextIndex;
        modified = true;
      }
    }
  });

  if (modified) {
    await saveStorage({ templates });
    renderTemplates();
    setStatus(direction > 0 ? 'Stepped all to next row' : 'Stepped all to previous row');
    triggerFillAcrossAllFrames();
  }
}

// Reset All to Row 1
async function resetAllRows() {
  const { templates } = await getStorage();
  let modified = false;

  Object.keys(templates).forEach((id) => {
    const t = templates[id];
    if (t.currentRowIndex !== 0) {
      t.currentRowIndex = 0;
      modified = true;
    }
  });

  if (modified) {
    await saveStorage({ templates });
    renderTemplates();
    setStatus('Reset all templates to Row 1');
    triggerFillAcrossAllFrames();
  }
}

// Trigger Fill Across All Frames
async function triggerFillAcrossAllFrames() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
      setStatus('Cannot run on internal browser pages', 'warning');
      return;
    }

    // Attempt injection in case the page was opened before the extension was installed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js'],
      });
    } catch (e) {}

    chrome.tabs.sendMessage(tab.id, { action: 'fill' }, (res) => {
      const err = chrome.runtime.lastError; // Suppresses unchecked error
      if (err) return;
      if (res?.success) {
        setStatus(`Filled ${res.count || ''} fields!`);
      }
    });
  } catch (err) {
    console.warn('Trigger fill error suppressed:', err);
  }
}

// Initialize Popup
document.addEventListener('DOMContentLoaded', () => {
  renderTemplates();

  const createBtn = document.getElementById('btn-create-template');
  if (createBtn) {
    createBtn.addEventListener('click', () => recordCurrentPage());
  }

  const nameInput = document.getElementById('new-template-name');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') recordCurrentPage();
    });
  }

  const fillBtn = document.getElementById('btn-fill-now');
  if (fillBtn) {
    fillBtn.addEventListener('click', async () => {
      await triggerFillAcrossAllFrames();
    });
  }

  const exportBtn = document.getElementById('btn-export-excel');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  const excelInput = document.getElementById('excel-file-input');
  if (excelInput) {
    excelInput.addEventListener('change', handleExcelImport);
  }

  const prevBtn = document.getElementById('btn-prev-all');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => stepAllRows(-1));
  }

  const nextBtn = document.getElementById('btn-next-all');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => stepAllRows(1));
  }

  const resetBtn = document.getElementById('btn-reset-all');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllRows);
  }

  const clearBtn = document.getElementById('btn-clear-all');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all recorded templates?')) {
        await saveStorage({ templates: {} });
        setStatus('All templates cleared');
        renderTemplates();
      }
    });
  }
});
