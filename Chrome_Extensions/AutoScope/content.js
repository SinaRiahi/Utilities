// AutoScope Content Script
if (!window.__autoscopeInjected) {
window.__autoscopeInjected = true;

let inspectMode = false;
let currentHighlightedElement = null;
let tooltipElement = null;
let toastElement = null;

function setupUI() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.id = 'autoscope-tooltip';
        document.body.appendChild(tooltipElement);
    }
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = 'autoscope-toast';
        document.body.appendChild(toastElement);
    }
}

function showToast(msg) {
    if (!toastElement) return;
    toastElement.textContent = msg;
    toastElement.classList.add('show');
    setTimeout(() => {
        toastElement.classList.remove('show');
    }, 3000);
}

function getBestSelector(el) {
    if (el.hasAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    if (el.hasAttribute('data-test-id')) return `[data-test-id="${el.getAttribute('data-test-id')}"]`;
    if (el.hasAttribute('aria-label')) return `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute('aria-label')}"]`;
    if (el.id) return `#${el.id}`;
    
    // Playwright textual selector logic
    let text = el.innerText?.trim();
    if (text && text.length < 50 && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
        return `text="${text}"`;
    }

    if (el.name) return `[name="${el.name}"]`;
    if (el.placeholder) return `[placeholder="${el.placeholder}"]`;

    // Fallback to path
    if (el === document.body) return 'body';
    
    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break; // IDs are usually unique enough
        } else {
            let sibling = current, nth = 1;
            while (sibling = sibling.previousElementSibling) {
                if (sibling.tagName === current.tagName) nth++;
            }
            if (nth > 1 || current.nextElementSibling) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        current = current.parentNode;
    }
    return path.join(' > ');
}

function getElementInfo(el) {
    const rect = el.getBoundingClientRect();
    return {
        tag: el.tagName.toLowerCase(),
        selector: getBestSelector(el),
        text: el.innerText?.trim().substring(0, 50) || el.value || '',
        isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden',
        attributes: {
            id: el.id,
            className: el.className,
            name: el.name,
            placeholder: el.placeholder,
            type: el.type,
            href: el.href,
            'aria-label': el.getAttribute('aria-label'),
            'data-testid': el.getAttribute('data-testid')
        }
    };
}

function handleMouseMove(e) {
    if (!inspectMode) return;
    
    const target = e.target;
    if (target === tooltipElement || target === toastElement) return;

    if (currentHighlightedElement && currentHighlightedElement !== target) {
        currentHighlightedElement.classList.remove('autoscope-highlight');
    }

    currentHighlightedElement = target;
    currentHighlightedElement.classList.add('autoscope-highlight');

    // Update Tooltip
    const info = getElementInfo(target);
    tooltipElement.innerHTML = `
        <span><strong>Tag:</strong> ${info.tag}</span>
        <span><strong>Selector:</strong> ${info.selector}</span>
        ${info.text ? `<span><strong>Text:</strong> "${info.text}"</span>` : ''}
    `;
    
    // Position tooltip
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    
    // Screen bounds check
    const tooltipRect = tooltipElement.getBoundingClientRect();
    if (x + tooltipRect.width > window.innerWidth) x = e.clientX - tooltipRect.width - 15;
    if (y + tooltipRect.height > window.innerHeight) y = e.clientY - tooltipRect.height - 15;

    tooltipElement.style.left = x + 'px';
    tooltipElement.style.top = y + 'px';
    tooltipElement.style.opacity = '1';
}

function handleClick(e) {
    if (!inspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();

    const info = getElementInfo(e.target);
    
    // Copy to clipboard
    navigator.clipboard.writeText(info.selector).then(() => {
        showToast(`Copied to clipboard: ${info.selector}`);
    }).catch(() => {
        showToast(`Selected: ${info.selector}`);
    });

    // Disable inspect mode after picking
    toggleInspectMode();
}

function toggleInspectMode() {
    inspectMode = !inspectMode;
    if (inspectMode) {
        setupUI();
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
    } else {
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.remove('autoscope-highlight');
            currentHighlightedElement = null;
        }
        if (tooltipElement) {
            tooltipElement.style.opacity = '0';
        }
    }
    return inspectMode;
}

function scanPage() {
    // Collect interactable elements
    const interactables = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'));
    
    const results = interactables.map(el => {
        const info = getElementInfo(el);
        // Clean up empty attributes
        const cleanAttr = {};
        for (const [k, v] of Object.entries(info.attributes)) {
            if (v && v.length > 0) cleanAttr[k] = v;
        }
        info.attributes = cleanAttr;
        return info;
    }).filter(info => info.isVisible);

    // Format as Markdown
    let md = `# AutoScope Scan: ${document.title}\n`;
    md += `**URL:** ${window.location.href}\n`;
    md += `**Timestamp:** ${new Date().toISOString()}\n\n`;
    md += `## Interactable Elements (${results.length})\n\n`;
    md += `| Tag | Text / Value | Selector | Attributes |\n`;
    md += `|---|---|---|---|\n`;
    
    results.forEach(info => {
        let attrStr = Object.entries(info.attributes).map(([k,v]) => `${k}="${v}"`).join(' ');
        let cleanText = (info.text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        let cleanSelector = info.selector.replace(/\|/g, '\\|');
        let cleanAttr = attrStr.replace(/\|/g, '\\|');
        md += `| \`${info.tag}\` | ${cleanText} | \`${cleanSelector}\` | \`${cleanAttr}\` |\n`;
    });

    return { markdown: md, count: results.length, title: document.title };
}

// Listener for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleInspect") {
        const isActive = toggleInspectMode();
        sendResponse({ active: isActive });
    } else if (request.action === "scanPage") {
        const data = scanPage();
        sendResponse({ success: true, data: data });
        setupUI();
        showToast(`Scanned ${data.count} elements!`);
    }
    return true;
});
}
