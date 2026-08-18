/**
 * Field Filler - Quill Edition (v2.0)
 * Multi-Template, Multi-Sheet Excel Automation Controller
 */

// Storage Helpers
async function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['templates', 'activeTemplateId'], (res) => {
      resolve({
        templates: res.templates || {},
        activeTemplateId: res.activeTemplateId || null,
      });
    });
  });
}

async function saveStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

// UI Status Display
function setStatus(text, type = 'normal') {
  const bar = document.getElementById('status-bar');
  const dot = document.getElementById('status-icon');
  const label = document.getElementById('status-text');

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
  function getFieldSignature(element) {
    if (element.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label && label.innerText && label.innerText.trim()) return label.innerText.trim();
      } catch (e) {}
    }
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, select, textarea');
      inputs.forEach((i) => i.remove());
      const text = clone.innerText.trim();
      if (text) return text;
    }
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend && legend.innerText.trim()) {
        const baseLabel = element.name || element.placeholder || element.getAttribute('aria-label');
        if (baseLabel) return `${legend.innerText.trim()} > ${baseLabel.trim()}`;
      }
    }
    if (element.getAttribute('aria-label')) return element.getAttribute('aria-label').trim();
    if (element.placeholder && element.placeholder.trim()) return element.placeholder.trim();
    if (element.name && element.name.trim()) return element.name.trim();

    let prev = element.previousElementSibling;
    while (prev) {
      if (prev.tagName && (prev.tagName.toLowerCase() === 'label' || prev.classList.contains('label'))) {
        if (prev.innerText && prev.innerText.trim()) return prev.innerText.trim();
      }
      prev = prev.previousElementSibling;
    }
    return null;
  }

  function getFieldGroupLabel(element) {
    const parent = element.closest('div');
    if (parent) {
      const header = parent.querySelector('span, label, p, h4, h5');
      if (header && header.innerText.trim()) return header.innerText.trim();
    }
    return element.name || '';
  }

  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
  );
  const data = {};

  Array.from(inputs).forEach((input) => {
    const sig = getFieldSignature(input);
    if (!sig) return;

    if (input.tagName.toLowerCase() === 'select') {
      if (input.multiple) {
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
        data[sig] = { type: 'radio', group: groupLabel, name: input.name, value: input.value || sig, checked: true };
        if (groupLabel && groupLabel !== sig) {
          data[groupLabel] = { type: 'radio', group: groupLabel, name: input.name, value: input.value || sig, checked: true };
        }
      }
    } else if (input.value !== undefined && input.value !== '') {
      data[sig] = { type: input.type || 'text', value: input.value };
    }
  });

  return data;
}

// In-Frame Trigger Fill Function
function inPageTriggerFill() {
  if (typeof fillActiveTemplates === 'function') {
    return fillActiveTemplates();
  } else {
    // If content script was not loaded yet, dispatch event
    window.postMessage({ type: 'FIELD_FILLER_TRIGGER' }, '*');
    return { success: true };
  }
}

// Record Form Fields from Active Tab across all frames
async function recordCurrentPage(targetTemplateId = null) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus('No active browser tab found', 'error');
      return;
    }

    // Try executing directly across all frames with chrome.scripting
    let collectedData = {};
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
    } catch (e) {
      console.warn('Scripting execute failed, trying message passing fallback:', e);
    }

    // Fallback to sendMessage if needed
    if (Object.keys(collectedData).length === 0) {
      const resp = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'collect' }, (r) => {
          resolve(r || null);
        });
      });
      if (resp && resp.data) {
        collectedData = resp.data;
      }
    }

    const fieldCount = Object.keys(collectedData).length;
    if (fieldCount === 0) {
      setStatus('No form fields detected. Ensure form fields have values or labels.', 'warning');
      return;
    }

    const { templates } = await getStorage();
    let templateName = '';

    if (targetTemplateId && templates[targetTemplateId]) {
      // Updating existing
      templates[targetTemplateId].fields = {
        ...(templates[targetTemplateId].fields || {}),
        ...collectedData,
      };
      templates[targetTemplateId].updatedAt = Date.now();
      templateName = templates[targetTemplateId].name;
    } else {
      // Creating new
      const nameInput = document.getElementById('new-template-name');
      const customName = nameInput.value.trim();
      templateName = customName || `Page ${Object.keys(templates).length + 1}`;
      const newId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      // Build default initial row
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

      nameInput.value = '';
    }

    await saveStorage({ templates });
    setStatus(`Recorded ${fieldCount} fields into "${templateName}"!`);
    renderTemplates();
  } catch (err) {
    console.error(err);
    setStatus('Error capturing page fields', 'error');
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

  const wb = XLSX.utils.book_new();

  templateIds.forEach((id) => {
    const t = templates[id];
    const fieldKeys = Object.keys(t.fields || {});

    // Prepare table data rows
    let sheetData = [];

    if (t.rows && t.rows.length > 0) {
      // Export existing iteration rows
      sheetData = t.rows.map((row) => {
        const cleanRow = {};
        fieldKeys.forEach((key) => {
          cleanRow[key] = row[key] ?? t.fields[key]?.value ?? '';
        });
        return cleanRow;
      });
    } else {
      // Export baseline recorded row
      const baseRow = {};
      fieldKeys.forEach((key) => {
        baseRow[key] = t.fields[key]?.value ?? '';
      });
      sheetData = [baseRow];
    }

    // Convert to sheet
    const ws = XLSX.utils.json_to_sheet(sheetData);

    // Clean sheet name (Excel limits sheet names to 31 chars and no / \ ? * : [ ])
    let cleanSheetName = t.name.replace(/[/\\?*:[\]]/g, '_').substring(0, 31);
    if (!cleanSheetName) cleanSheetName = 'Sheet';

    // Handle potential duplicate sheet names in workbook
    let finalSheetName = cleanSheetName;
    let counter = 1;
    while (wb.SheetNames.includes(finalSheetName)) {
      finalSheetName = `${cleanSheetName.substring(0, 28)}_${counter++}`;
    }

    XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
  });

  // Trigger download
  XLSX.writeFile(wb, `Field_Filler_Templates_${new Date().toISOString().slice(0, 10)}.xlsx`);
  setStatus('Exported multi-sheet Excel file!');
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

        // Try to find matching template by name
        let matchedId = Object.keys(templates).find(
          (id) => templates[id].name.toLowerCase().trim() === sheetName.toLowerCase().trim()
        );

        if (matchedId) {
          // Update existing template with new rows and enable iteration mode
          templates[matchedId].rows = rows;
          templates[matchedId].iterationMode = true;
          templates[matchedId].currentRowIndex = 0;
          importedSheetCount++;
          totalRowsCount += rows.length;
        } else {
          // Create new template from imported sheet
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
  event.target.value = ''; // Reset input
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

    // Trigger auto-fill on active tab
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
    if (!tab) return;

    // Ensure content script is injected into all frames
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content.js'],
    }).catch(() => {});

    // Send fill message
    chrome.tabs.sendMessage(tab.id, { action: 'fill' }, (res) => {
      if (res?.success) {
        setStatus(`Filled ${res.count || ''} fields!`);
      }
    });
  } catch (err) {
    console.error('Trigger fill error:', err);
  }
}

// Initialize Popup
document.addEventListener('DOMContentLoaded', () => {
  renderTemplates();

  // Create Template Button
  document.getElementById('btn-create-template').addEventListener('click', () => {
    recordCurrentPage();
  });

  // Enter Key on Template Name Input
  document.getElementById('new-template-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') recordCurrentPage();
  });

  // Fill Current Page Button
  document.getElementById('btn-fill-now').addEventListener('click', async () => {
    await triggerFillAcrossAllFrames();
  });

  // Export Excel
  document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

  // Import Excel
  document.getElementById('excel-file-input').addEventListener('change', handleExcelImport);

  // Batch Iteration Controls
  document.getElementById('btn-prev-all').addEventListener('click', () => stepAllRows(-1));
  document.getElementById('btn-next-all').addEventListener('click', () => stepAllRows(1));
  document.getElementById('btn-reset-all').addEventListener('click', resetAllRows);

  // Clear All
  document.getElementById('btn-clear-all').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all recorded templates?')) {
      await saveStorage({ templates: {} });
      setStatus('All templates cleared');
      renderTemplates();
    }
  });
});
