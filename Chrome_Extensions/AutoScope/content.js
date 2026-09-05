// AutoScope — Advanced Automation & Page Inspector Content Script
(function () {
    if (window.__autoscopeEngine) {
        // Already loaded, expose handle
        return;
    }

    const state = {
        inspectMode: false,
        hudVisible: false,
        hudCollapsed: false,
        currentElement: null,
        pinnedElement: null,
        scanData: null,
    };

    // UI Elements
    let highlightOverlay = null;
    let badgeOverlay = null;
    let hudContainer = null;
    let toastContainer = null;

    // --- DOM & UI Helpers ---
    function setupDomUI() {
        if (!highlightOverlay) {
            highlightOverlay = document.createElement('div');
            highlightOverlay.id = 'autoscope-highlight-box';
            document.documentElement.appendChild(highlightOverlay);

            badgeOverlay = document.createElement('div');
            badgeOverlay.id = 'autoscope-dim-badge';
            document.documentElement.appendChild(badgeOverlay);
        }

        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'autoscope-toast-container';
            document.documentElement.appendChild(toastContainer);
        }

        if (!hudContainer) {
            createHUD();
        }
    }

    function showToast(message, type = 'info') {
        setupDomUI();
        const toast = document.createElement('div');
        toast.className = `autoscope-toast autoscope-toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function copyToClipboard(text, label = 'Copied') {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`📋 ${label} copied to clipboard!`, 'success');
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(`📋 ${label} copied to clipboard!`, 'success');
        });
    }

    // --- Framework & Tech Stack Detection ---
    function detectTechStack() {
        const detected = [];

        // React
        const hasReactAttr = document.querySelector('[data-reactroot], [data-reactid], [data-react-checksum]');
        const hasReactFiber = Array.from(document.querySelectorAll('body *')).some(el => {
            return Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        });
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || hasReactAttr || hasReactFiber) {
            detected.push({ name: 'React', category: 'Frontend UI', confidence: 'High' });
        }

        // Next.js
        if (document.getElementById('__next') || window.__NEXT_DATA__) {
            detected.push({ name: 'Next.js', category: 'React Framework (SSR/SSG)', confidence: 'High' });
        }

        // Vue.js
        const hasVueAttr = document.querySelector('[data-v-]') || document.querySelector('[v-cloak]');
        if (window.__VUE__ || window.__vue_app__ || hasVueAttr) {
            detected.push({ name: 'Vue.js', category: 'Frontend UI', confidence: 'High' });
        }

        // Nuxt.js
        if (document.getElementById('__nuxt') || window.__NUXT__) {
            detected.push({ name: 'Nuxt.js', category: 'Vue Framework', confidence: 'High' });
        }

        // Angular
        const hasAngular = document.querySelector('[ng-version], [ng-app], [ng-controller]');
        if (window.angular || window.ng || hasAngular) {
            const version = hasAngular ? hasAngular.getAttribute('ng-version') : '';
            detected.push({ name: `Angular ${version ? 'v' + version : ''}`.trim(), category: 'Frontend Framework', confidence: 'High' });
        }

        // Svelte / SvelteKit
        const hasSvelte = Array.from(document.querySelectorAll('*')).some(el => {
            return el.className && typeof el.className === 'string' && el.className.includes('svelte-');
        });
        if (window.__svelte || hasSvelte || document.getElementById('svelte')) {
            detected.push({ name: 'Svelte / SvelteKit', category: 'Reactive Framework', confidence: 'High' });
        }

        // jQuery
        if (window.jQuery || window.$?.fn?.jquery) {
            const jqVer = window.jQuery?.fn?.jquery || window.$?.fn?.jquery || '';
            detected.push({ name: `jQuery ${jqVer}`.trim(), category: 'DOM Library', confidence: 'High' });
        }

        // Tailwind CSS
        const hasTailwindClasses = Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => {
            const c = el.className;
            return typeof c === 'string' && (/\b(flex|grid|hidden|block|relative|absolute|text-|bg-|p-\d|m-\d)\b/.test(c));
        });
        if (hasTailwindClasses) {
            detected.push({ name: 'Tailwind CSS', category: 'Styling', confidence: 'Medium' });
        }

        // Bootstrap
        const hasBootstrap = document.querySelector('[class*="col-md-"], [class*="col-sm-"], [class*="btn-primary"], [class*="navbar-nav"]');
        if (hasBootstrap || window.bootstrap) {
            detected.push({ name: 'Bootstrap', category: 'Styling & UI', confidence: 'Medium' });
        }

        // Shadow DOM presence
        let shadowRootsCount = 0;
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) shadowRootsCount++;
        });
        if (shadowRootsCount > 0) {
            detected.push({ name: `Shadow DOM (${shadowRootsCount} roots)`, category: 'Web Components', confidence: 'High' });
        }

        return detected;
    }

    // --- Precision Selector Generation ---
    function isUniqueSelector(selector) {
        try {
            return document.querySelectorAll(selector).length === 1;
        } catch {
            return false;
        }
    }

    function getAssociatedLabel(el) {
        if (!el) return '';
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label && label.innerText.trim()) return label.innerText.trim();
        }
        const parentLabel = el.closest('label');
        if (parentLabel) {
            // Clone without input's own text
            const clone = parentLabel.cloneNode(true);
            const insideInput = clone.querySelector('input, select, textarea');
            if (insideInput) insideInput.remove();
            const txt = clone.innerText.trim();
            if (txt) return txt;
        }
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
        if (el.getAttribute('aria-labelledby')) {
            const ref = document.getElementById(el.getAttribute('aria-labelledby'));
            if (ref && ref.innerText.trim()) return ref.innerText.trim();
        }
        return '';
    }

    function getAriaRole(el) {
        if (!el) return '';
        const explicit = el.getAttribute('role');
        if (explicit) return explicit;

        const tag = el.tagName.toLowerCase();
        if (tag === 'button') return 'button';
        if (tag === 'a' && el.hasAttribute('href')) return 'link';
        if (tag === 'input') {
            const t = (el.type || 'text').toLowerCase();
            if (['button', 'submit', 'reset'].includes(t)) return 'button';
            if (['checkbox'].includes(t)) return 'checkbox';
            if (['radio'].includes(t)) return 'radio';
            if (['search'].includes(t)) return 'searchbox';
            return 'textbox';
        }
        if (tag === 'select') return 'combobox';
        if (tag === 'textarea') return 'textbox';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
        if (tag === 'dialog') return 'dialog';
        return '';
    }

    function getPlaywrightLocator(el) {
        if (!el) return { locator: '', strategy: '' };

        // 1. Test IDs (Highest standard for automated testing)
        const testIdAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy'];
        for (const attr of testIdAttrs) {
            if (el.hasAttribute(attr)) {
                const val = el.getAttribute(attr);
                return {
                    locator: `page.getByTestId('${val}')`,
                    strategy: 'Test ID',
                    raw: `[${attr}="${val}"]`
                };
            }
        }

        // 2. Role with Name
        const role = getAriaRole(el);
        const name = (getAssociatedLabel(el) || el.innerText?.trim() || el.getAttribute('title') || '').substring(0, 40).replace(/\s+/g, ' ');
        if (role && name && name.length >= 2 && !name.includes('\n')) {
            const escapedName = name.replace(/'/g, "\\'");
            return {
                locator: `page.getByRole('${role}', { name: '${escapedName}' })`,
                strategy: 'Role + Accessible Name',
                raw: `role=${role}[name="${name}"]`
            };
        }

        // 3. Label text (for form inputs)
        const labelText = getAssociatedLabel(el);
        if (labelText && labelText.length < 50 && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
            return {
                locator: `page.getByLabel('${labelText.replace(/'/g, "\\'")}')`,
                strategy: 'Label Text',
                raw: `label="${labelText}"`
            };
        }

        // 4. Placeholder
        if (el.placeholder && el.placeholder.trim()) {
            return {
                locator: `page.getByPlaceholder('${el.placeholder.trim().replace(/'/g, "\\'")}')`,
                strategy: 'Placeholder',
                raw: `[placeholder="${el.placeholder.trim()}"]`
            };
        }

        // 5. Button or Link text
        if (['BUTTON', 'A'].includes(el.tagName)) {
            const text = el.innerText?.trim();
            if (text && text.length > 1 && text.length < 40 && !text.includes('\n')) {
                return {
                    locator: `page.getByRole('${el.tagName.toLowerCase() === 'button' ? 'button' : 'link'}', { name: '${text.replace(/'/g, "\\'")}' })`,
                    strategy: 'Text/Role',
                    raw: `text="${text}"`
                };
            }
        }

        // 6. Resilient CSS
        const css = getUniqueCss(el);
        return {
            locator: `page.locator('${css.replace(/'/g, "\\'")}')`,
            strategy: 'Unique CSS Locator',
            raw: css
        };
    }

    function getUniqueCss(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

        // ID test (if unique)
        if (el.id && !/^\d/.test(el.id) && !el.id.includes(':') && isUniqueSelector(`#${CSS.escape(el.id)}`)) {
            return `#${CSS.escape(el.id)}`;
        }

        // Standard test attributes
        for (const attr of ['data-testid', 'data-test-id', 'data-qa', 'data-cy']) {
            if (el.hasAttribute(attr)) {
                const s = `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
                if (isUniqueSelector(s)) return s;
            }
        }

        // Unique Name
        if (el.name) {
            const s = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
            if (isUniqueSelector(s)) return s;
        }

        // Unique aria-label
        if (el.getAttribute('aria-label')) {
            const s = `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(el.getAttribute('aria-label'))}"]`;
            if (isUniqueSelector(s)) return s;
        }

        // Unique classes
        if (el.classList && el.classList.length > 0) {
            const filteredClasses = Array.from(el.classList).filter(c => {
                return !c.includes(':') && !c.includes('/') && !c.includes('[') && !c.startsWith('autoscope');
            });
            if (filteredClasses.length > 0) {
                const classSelector = `${el.tagName.toLowerCase()}.${filteredClasses.slice(0, 2).map(c => CSS.escape(c)).join('.')}`;
                if (isUniqueSelector(classSelector)) return classSelector;
            }
        }

        // Hierarchy path
        const path = [];
        let curr = el;
        while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.body) {
            let seg = curr.tagName.toLowerCase();
            if (curr.id && isUniqueSelector(`#${CSS.escape(curr.id)}`)) {
                path.unshift(`#${CSS.escape(curr.id)}`);
                break;
            }

            let nth = 1;
            let sib = curr;
            while ((sib = sib.previousElementSibling)) {
                if (sib.tagName === curr.tagName) nth++;
            }

            if (nth > 1 || curr.nextElementSibling) {
                seg += `:nth-of-type(${nth})`;
            }

            path.unshift(seg);
            curr = curr.parentElement;
            if (path.length > 4) break;
        }

        return path.join(' > ');
    }

    function getXPath(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

        // Semantic XPath with text or attributes
        const tag = el.tagName.toLowerCase();
        if (el.id) {
            return `//${tag}[@id='${el.id}']`;
        }
        if (el.hasAttribute('data-testid')) {
            return `//${tag}[@data-testid='${el.getAttribute('data-testid')}']`;
        }
        if (el.name) {
            return `//${tag}[@name='${el.name}']`;
        }
        const text = el.innerText?.trim();
        if (text && text.length > 0 && text.length < 35 && !text.includes("'") && !text.includes('\n')) {
            return `//${tag}[normalize-space()='${text}']`;
        }

        // Hierarchical XPath
        const segments = [];
        let curr = el;
        while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.body) {
            let index = 1;
            let sib = curr.previousSibling;
            while (sib) {
                if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === curr.tagName) index++;
                sib = sib.previousSibling;
            }
            segments.unshift(`${curr.tagName.toLowerCase()}[${index}]`);
            curr = curr.parentNode;
            if (segments.length > 4) break;
        }
        return '/' + segments.join('/');
    }

    function generateCodeSnippets(el, pwLocator) {
        const tag = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();
        const locatorStr = pwLocator.locator;

        let pwSnippet = '';
        let pySnippet = '';
        let puppeteerSnippet = '';
        const cssSel = getUniqueCss(el);

        if (tag === 'input' && ['checkbox', 'radio'].includes(type)) {
            pwSnippet = `await ${locatorStr}.check();`;
            pySnippet = `${locatorStr.replace('page.', 'page.')}.check()`;
            puppeteerSnippet = `await page.click('${cssSel}');`;
        } else if (['input', 'textarea'].includes(tag) || el.isContentEditable) {
            pwSnippet = `await ${locatorStr}.fill('Sample Text');`;
            pySnippet = `${locatorStr}.fill("Sample Text")`;
            puppeteerSnippet = `await page.type('${cssSel}', 'Sample Text');`;
        } else if (tag === 'select') {
            pwSnippet = `await ${locatorStr}.selectOption({ index: 1 });`;
            pySnippet = `${locatorStr}.select_option(index=1)`;
            puppeteerSnippet = `await page.select('${cssSel}', 'value');`;
        } else {
            // Clickable default
            pwSnippet = `await ${locatorStr}.click();`;
            pySnippet = `${locatorStr}.click()`;
            puppeteerSnippet = `await page.click('${cssSel}');`;
        }

        return { pwSnippet, pySnippet, puppeteerSnippet };
    }

    function extractElementDetails(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        const pw = getPlaywrightLocator(el);
        const css = getUniqueCss(el);
        const xpath = getXPath(el);
        const snippets = generateCodeSnippets(el, pw);
        const label = getAssociatedLabel(el);

        return {
            tag: el.tagName.toLowerCase(),
            role: getAriaRole(el) || 'none',
            id: el.id || '',
            name: el.name || '',
            type: el.type || '',
            label: label,
            placeholder: el.placeholder || '',
            value: el.value || '',
            text: (el.innerText?.trim() || el.textContent?.trim() || '').substring(0, 100),
            dimensions: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top + window.scrollY),
                left: Math.round(rect.left + window.scrollX),
            },
            isVisible: rect.width > 0 && rect.height > 0 && computed.visibility !== 'hidden' && computed.display !== 'none',
            isInteractive: isElementInteractive(el),
            playwright: pw,
            css: css,
            xpath: xpath,
            snippets: snippets,
            attributes: Array.from(el.attributes).reduce((acc, a) => {
                acc[a.name] = a.value;
                return acc;
            }, {})
        };
    }

    function isElementInteractive(el) {
        const tag = el.tagName.toLowerCase();
        if (['button', 'select', 'textarea', 'a', 'input'].includes(tag)) return true;
        if (el.hasAttribute('role') && ['button', 'link', 'checkbox', 'radio', 'combobox', 'tab', 'menuitem'].includes(el.getAttribute('role'))) return true;
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
        if (el.isContentEditable) return true;
        const style = window.getComputedStyle(el);
        if (style.cursor === 'pointer' && tag !== 'html' && tag !== 'body') return true;
        return false;
    }

    // --- Full Page Automation Scanner ---
    function scanFullPage() {
        const startTime = Date.now();
        const frameworks = detectTechStack();

        // 1. Page Context
        const pageContext = {
            title: document.title || 'Untitled Page',
            url: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname,
            timestamp: new Date().toISOString(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                documentWidth: document.documentElement.scrollWidth,
                documentHeight: document.documentElement.scrollHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            },
            charset: document.characterSet || 'UTF-8',
            frameworks: frameworks,
            storageMetrics: {
                localStorageCount: (function () { try { return localStorage.length; } catch { return 0; } })(),
                sessionStorageCount: (function () { try { return sessionStorage.length; } catch { return 0; } })(),
            }
        };

        // 2. Forms & Inputs
        const forms = Array.from(document.querySelectorAll('form')).map((f, i) => {
            return {
                index: i + 1,
                id: f.id || '',
                name: f.name || '',
                action: f.getAttribute('action') || '',
                method: (f.getAttribute('method') || 'GET').toUpperCase(),
                target: f.target || '',
                pwLocator: getPlaywrightLocator(f).locator
            };
        });

        // 3. Form Input Controls
        const inputElements = Array.from(document.querySelectorAll('input, select, textarea, [contenteditable="true"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        }).map(el => {
            return extractElementDetails(el);
        });

        // 4. Buttons & Clickable Action Triggers
        const actionElements = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a.btn, a[class*="button"], a[class*="btn"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        }).map(el => {
            return extractElementDetails(el);
        });

        // 5. Navigation Links
        const links = Array.from(document.querySelectorAll('a[href]')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        }).slice(0, 100).map(el => {
            return {
                text: (el.innerText || el.textContent || '').trim().substring(0, 50),
                href: el.href,
                isExternal: el.hostname !== window.location.hostname,
                target: el.target || '_self',
                pwLocator: getPlaywrightLocator(el).locator
            };
        });

        // 6. iFrames
        const iframes = Array.from(document.querySelectorAll('iframe')).map((iframe, idx) => {
            let isSameOrigin = false;
            try {
                isSameOrigin = iframe.contentWindow?.location?.href !== undefined;
            } catch {
                isSameOrigin = false;
            }
            return {
                index: idx + 1,
                id: iframe.id || '',
                name: iframe.name || '',
                src: iframe.src || '',
                sameOrigin: isSameOrigin,
                locator: `page.frameLocator('iframe${iframe.id ? "#" + iframe.id : (iframe.name ? `[name="${iframe.name}"]` : `:nth-of-type(${idx + 1})`)}')`
            };
        });

        // 7. Modals & Dialogs
        const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]')).map(d => {
            return {
                tag: d.tagName.toLowerCase(),
                role: d.getAttribute('role') || 'dialog',
                isOpen: d.hasAttribute('open') || window.getComputedStyle(d).display !== 'none',
                locator: getPlaywrightLocator(d).locator
            };
        });

        // 8. Tables
        const tables = Array.from(document.querySelectorAll('table')).map((t, idx) => {
            const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean);
            const rowCount = t.querySelectorAll('tr').length;
            return {
                index: idx + 1,
                headers: headers.slice(0, 8),
                rowCount: rowCount,
                locator: getPlaywrightLocator(t).locator
            };
        });

        const scanDuration = Date.now() - startTime;

        const scanData = {
            meta: {
                scanDurationMs: scanDuration,
                generator: 'AutoScope v2.0',
            },
            context: pageContext,
            forms: forms,
            inputs: inputElements,
            actions: actionElements,
            links: links,
            iframes: iframes,
            dialogs: dialogs,
            tables: tables
        };

        state.scanData = scanData;
        return scanData;
    }

    // --- Markdown Automation Dossier Formatter ---
    function formatMarkdownDossier(data) {
        const { context, forms, inputs, actions, iframes, dialogs, tables } = data;

        let md = `# 🎯 AutoScope Automation Dossier: ${context.title}\n\n`;
        md += `> Comprehensive structural reconnaissance and code-ready selectors for browser automation (Playwright / Puppeteer / Selenium / Python).\n\n`;

        // Section 1: Page Context
        md += `## 🌐 1. Page Context & Environment\n\n`;
        md += `| Attribute | Value |\n`;
        md += `| :--- | :--- |\n`;
        md += `| **URL** | [${context.url}](${context.url}) |\n`;
        md += `| **Domain** | \`${context.origin}\` |\n`;
        md += `| **Path** | \`${context.pathname}\` |\n`;
        md += `| **Viewport** | \`${context.viewport.width} × ${context.viewport.height} px\` (Scale: ${context.viewport.devicePixelRatio}x) |\n`;
        md += `| **Document Size** | \`${context.viewport.documentWidth} × ${context.viewport.documentHeight} px\` |\n`;
        md += `| **Timestamp** | \`${context.timestamp}\` |\n\n`;

        // Section 2: Frameworks & Tech Stack
        md += `## ⚡ 2. Detected Technologies & Frameworks\n\n`;
        if (context.frameworks.length > 0) {
            md += `| Technology | Category | Confidence |\n`;
            md += `| :--- | :--- | :--- |\n`;
            context.frameworks.forEach(f => {
                md += `| **${f.name}** | ${f.category} | \`${f.confidence}\` |\n`;
            });
            md += `\n`;
        } else {
            md += `*No major SPA framework detected (standard HTML/JS document).* \n\n`;
        }

        // Section 3: Forms & Form Fields
        md += `## 📝 3. Forms & Input Fields (${inputs.length})\n\n`;
        if (inputs.length > 0) {
            md += `| Label / Name | Type | Playwright Locator | Unique CSS | Quick Action Snippet |\n`;
            md += `| :--- | :--- | :--- | :--- | :--- |\n`;
            inputs.forEach(inp => {
                const label = (inp.label || inp.placeholder || inp.name || inp.id || 'Field').replace(/\|/g, '\\|').replace(/\n/g, ' ');
                const type = inp.type || inp.tag;
                const loc = `\`${inp.playwright.locator.replace(/\|/g, '\\|')}\``;
                const css = `\`${inp.css.replace(/\|/g, '\\|')}\``;
                const snippet = `\`${inp.snippets.pwSnippet.replace(/\|/g, '\\|')}\``;
                md += `| **${label}** | \`${type}\` | ${loc} | ${css} | ${snippet} |\n`;
            });
            md += `\n`;
        } else {
            md += `*No active input fields detected.*\n\n`;
        }

        // Section 4: Buttons & Clickable Triggers
        md += `## 🔘 4. Action Buttons & Triggers (${actions.length})\n\n`;
        if (actions.length > 0) {
            md += `| Button Text / Accessible Name | Tag / Role | Playwright Locator | Resilient Selector | Automation Action |\n`;
            md += `| :--- | :--- | :--- | :--- | :--- |\n`;
            actions.forEach(btn => {
                const text = (btn.text || btn.label || btn.name || 'Button').replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 45);
                const loc = `\`${btn.playwright.locator.replace(/\|/g, '\\|')}\``;
                const css = `\`${btn.css.replace(/\|/g, '\\|')}\``;
                const snippet = `\`${btn.snippets.pwSnippet.replace(/\|/g, '\\|')}\``;
                md += `| **${text}** | \`${btn.tag}\` / \`${btn.role}\` | ${loc} | ${css} | ${snippet} |\n`;
            });
            md += `\n`;
        } else {
            md += `*No standard action buttons detected.*\n\n`;
        }

        // Section 5: iFrames & Cross-Origin Boundaries
        md += `## 🖼️ 5. iFrames & Embeds (${iframes.length})\n\n`;
        if (iframes.length > 0) {
            md += `> ⚠️ **Automation Note**: Automation scripts cannot access elements inside iFrames directly via \`page.locator()\`. You must use \`frameLocator()\` as shown below.\n\n`;
            md += `| Frame # | Name / ID | Origin Type | Source URL | Playwright Frame Locator |\n`;
            md += `| :--- | :--- | :--- | :--- | :--- |\n`;
            iframes.forEach(f => {
                const idName = (f.name || f.id || 'N/A').replace(/\|/g, '\\|');
                const originType = f.sameOrigin ? '🟢 Same Origin' : '🔴 Cross-Origin';
                const src = (f.src || 'about:blank').replace(/\|/g, '\\|');
                const loc = `\`${f.locator.replace(/\|/g, '\\|')}\``;
                md += `| **#${f.index}** | \`${idName}\` | ${originType} | \`${src.substring(0, 40)}...\` | ${loc} |\n`;
            });
            md += `\n`;
        } else {
            md += `*No iFrames detected. Direct page automation without frame-switching.*\n\n`;
        }

        // Section 6: Dialogs & Overlays
        if (dialogs.length > 0) {
            md += `## 📦 6. Modals & Dialogs (${dialogs.length})\n\n`;
            dialogs.forEach((d, idx) => {
                md += `- Dialog #${idx + 1}: \`${d.locator}\` (Status: **${d.isOpen ? 'Open / Visible' : 'Closed'}**)\n`;
            });
            md += `\n`;
        }

        // Section 7: Complete Ready-to-Run Playwright Script Template
        md += `## 🎭 7. Ready-to-Run Playwright Test Script (\`test.spec.ts\`)\n\n`;
        md += `\`\`\`typescript\n`;
        md += generatePlaywrightTestScript(data);
        md += `\`\`\`\n\n`;

        // Section 8: Complete Python Playwright Script Template
        md += `## 🐍 8. Python Playwright Script (\`automate.py\`)\n\n`;
        md += `\`\`\`python\n`;
        md += generatePythonPlaywrightScript(data);
        md += `\`\`\`\n\n`;

        return md;
    }

    // --- Script Generators ---
    function generatePlaywrightTestScript(data) {
        const { context, inputs, actions } = data;
        let s = `import { test, expect } from '@playwright/test';\n\n`;
        s += `test('Automate ${context.title.replace(/'/g, "\\'")}', async ({ page }) => {\n`;
        s += `  // 1. Navigate to target page\n`;
        s += `  await page.goto('${context.url}');\n`;
        s += `  await page.waitForLoadState('networkidle');\n\n`;

        if (inputs.length > 0) {
            s += `  // 2. Fill Form Fields\n`;
            inputs.slice(0, 5).forEach(inp => {
                s += `  ${inp.snippets.pwSnippet}\n`;
            });
            s += `\n`;
        }

        if (actions.length > 0) {
            s += `  // 3. Trigger Primary Action\n`;
            s += `  ${actions[0].snippets.pwSnippet}\n\n`;
        }

        s += `  // 4. Assertions & Verification\n`;
        s += `  await expect(page).toHaveURL(/${context.pathname.replace(/\//g, '\\/')}/);\n`;
        s += `});\n`;
        return s;
    }

    function generatePythonPlaywrightScript(data) {
        const { context, inputs, actions } = data;
        let s = `from playwright.sync_api import sync_playwright\n\n`;
        s += `def run():\n`;
        s += `    with sync_playwright() as p:\n`;
        s += `        browser = p.chromium.launch(headless=False)\n`;
        s += `        page = browser.new_page()\n`;
        s += `        page.goto("${context.url}")\n\n`;

        if (inputs.length > 0) {
            s += `        # Fill Form Fields\n`;
            inputs.slice(0, 5).forEach(inp => {
                s += `        ${inp.snippets.pySnippet}\n`;
            });
            s += `\n`;
        }

        if (actions.length > 0) {
            s += `        # Click Action Trigger\n`;
            s += `        ${actions[0].snippets.pySnippet}\n\n`;
        }

        s += `        page.wait_for_timeout(3000)\n`;
        s += `        browser.close()\n\n`;
        s += `if __name__ == "__main__":\n`;
        s += `    run()\n`;
        return s;
    }

    // --- In-Page Automation HUD & Floating Dock ---
    function createHUD() {
        if (hudContainer) return;

        hudContainer = document.createElement('div');
        hudContainer.id = 'autoscope-hud-dock';
        hudContainer.innerHTML = `
            <div class="autoscope-hud-header">
                <div class="autoscope-hud-title">
                    <span class="autoscope-hud-logo">🎯</span>
                    <strong>AutoScope HUD</strong>
                    <span class="autoscope-badge" id="autoscope-status-badge">Inspect Active</span>
                </div>
                <div class="autoscope-hud-controls">
                    <button class="autoscope-btn-icon" id="autoscope-hud-collapse-btn" title="Minimize / Expand">_</button>
                    <button class="autoscope-btn-icon" id="autoscope-hud-close-btn" title="Close HUD">✕</button>
                </div>
            </div>
            
            <div class="autoscope-hud-body" id="autoscope-hud-content">
                <div class="autoscope-hud-tabs">
                    <button class="autoscope-tab-btn active" data-tab="inspector">🔍 Live Inspector</button>
                    <button class="autoscope-tab-btn" data-tab="insights">📊 Page Insights</button>
                    <button class="autoscope-tab-btn" data-tab="exports">⚡ Quick Exports</button>
                </div>

                <!-- Tab 1: Inspector -->
                <div class="autoscope-tab-pane active" id="pane-inspector">
                    <div id="autoscope-inspector-empty">
                        <p>Hover over or click any element on the page to analyze its automation selectors and code snippets.</p>
                        <p class="autoscope-hint">Press <strong>Esc</strong> to toggle inspection mode.</p>
                    </div>
                    <div id="autoscope-inspector-details" style="display:none;">
                        <div class="autoscope-row">
                            <span class="autoscope-tag-pill" id="autoscope-el-tag">button</span>
                            <span class="autoscope-dim-pill" id="autoscope-el-dim">120 × 40 px</span>
                            <span class="autoscope-role-pill" id="autoscope-el-role">role: button</span>
                        </div>
                        
                        <div class="autoscope-field-group">
                            <label>Playwright Locator:</label>
                            <div class="autoscope-code-copy-row">
                                <code id="autoscope-el-pw">page.getByRole(...)</code>
                                <button class="autoscope-btn-copy" id="autoscope-copy-pw">Copy</button>
                            </div>
                        </div>

                        <div class="autoscope-field-group">
                            <label>Unique CSS Selector:</label>
                            <div class="autoscope-code-copy-row">
                                <code id="autoscope-el-css">#id</code>
                                <button class="autoscope-btn-copy" id="autoscope-copy-css">Copy</button>
                            </div>
                        </div>

                        <div class="autoscope-field-group">
                            <label>XPath:</label>
                            <div class="autoscope-code-copy-row">
                                <code id="autoscope-el-xpath">//button[...]</code>
                                <button class="autoscope-btn-copy" id="autoscope-copy-xpath">Copy</button>
                            </div>
                        </div>

                        <div class="autoscope-actions-grid">
                            <button class="autoscope-btn-action" id="autoscope-copy-snippet-ts">Copy Playwright TS</button>
                            <button class="autoscope-btn-action" id="autoscope-copy-snippet-py">Copy Python Snippet</button>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Insights -->
                <div class="autoscope-tab-pane" id="pane-insights">
                    <div class="autoscope-stats-grid">
                        <div class="autoscope-stat-box">
                            <span class="stat-number" id="stat-inputs">-</span>
                            <span class="stat-label">Inputs / Fields</span>
                        </div>
                        <div class="autoscope-stat-box">
                            <span class="stat-number" id="stat-buttons">-</span>
                            <span class="stat-label">Buttons</span>
                        </div>
                        <div class="autoscope-stat-box">
                            <span class="stat-number" id="stat-forms">-</span>
                            <span class="stat-label">Forms</span>
                        </div>
                        <div class="autoscope-stat-box">
                            <span class="stat-number" id="stat-iframes">-</span>
                            <span class="stat-label">iFrames</span>
                        </div>
                    </div>
                    <div class="autoscope-tech-chips" id="autoscope-tech-chips-list">
                        <!-- Chips inserted dynamically -->
                    </div>
                    <button class="autoscope-btn-primary" id="autoscope-refresh-insights">🔄 Refresh Page Scan</button>
                </div>

                <!-- Tab 3: Exports -->
                <div class="autoscope-tab-pane" id="pane-exports">
                    <p class="autoscope-desc">Generate ready-to-use artifacts for your automation codebase or test suite.</p>
                    <div class="autoscope-export-buttons">
                        <button class="autoscope-btn-export" id="btn-export-md">
                            <span>📄 Download Automation Dossier (.md)</span>
                            <small>Full breakdown, selector tables & Playwright test</small>
                        </button>
                        <button class="autoscope-btn-export" id="btn-export-json">
                            <span>⚙️ Download Automation Spec (.json)</span>
                            <small>Structured JSON schema for bots and agents</small>
                        </button>
                        <button class="autoscope-btn-export" id="btn-export-spec-ts">
                            <span>🎭 Download Playwright Test (.spec.ts)</span>
                            <small>Ready-to-run Playwright test file</small>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.documentElement.appendChild(hudContainer);

        // Bind HUD events
        const collapseBtn = hudContainer.querySelector('#autoscope-hud-collapse-btn');
        const closeBtn = hudContainer.querySelector('#autoscope-hud-close-btn');
        const content = hudContainer.querySelector('#autoscope-hud-content');

        collapseBtn.addEventListener('click', () => {
            state.hudCollapsed = !state.hudCollapsed;
            content.style.display = state.hudCollapsed ? 'none' : 'block';
            collapseBtn.textContent = state.hudCollapsed ? '□' : '_';
        });

        closeBtn.addEventListener('click', () => {
            toggleHUD(false);
        });

        // Tab switching
        const tabBtns = hudContainer.querySelectorAll('.autoscope-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                hudContainer.querySelectorAll('.autoscope-tab-pane').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const targetId = `pane-${btn.getAttribute('data-tab')}`;
                hudContainer.querySelector(`#${targetId}`)?.classList.add('active');

                if (btn.getAttribute('data-tab') === 'insights') {
                    updateInsightsTab();
                }
            });
        });

        // Copy button listeners
        hudContainer.querySelector('#autoscope-copy-pw').addEventListener('click', () => {
            if (state.currentElement) {
                const details = extractElementDetails(state.currentElement);
                copyToClipboard(details.playwright.locator, 'Playwright Locator');
            }
        });

        hudContainer.querySelector('#autoscope-copy-css').addEventListener('click', () => {
            if (state.currentElement) {
                const details = extractElementDetails(state.currentElement);
                copyToClipboard(details.css, 'CSS Selector');
            }
        });

        hudContainer.querySelector('#autoscope-copy-xpath').addEventListener('click', () => {
            if (state.currentElement) {
                const details = extractElementDetails(state.currentElement);
                copyToClipboard(details.xpath, 'XPath');
            }
        });

        hudContainer.querySelector('#autoscope-copy-snippet-ts').addEventListener('click', () => {
            if (state.currentElement) {
                const details = extractElementDetails(state.currentElement);
                copyToClipboard(details.snippets.pwSnippet, 'Playwright TS Snippet');
            }
        });

        hudContainer.querySelector('#autoscope-copy-snippet-py').addEventListener('click', () => {
            if (state.currentElement) {
                const details = extractElementDetails(state.currentElement);
                copyToClipboard(details.snippets.pySnippet, 'Python Snippet');
            }
        });

        hudContainer.querySelector('#autoscope-refresh-insights').addEventListener('click', () => {
            scanFullPage();
            updateInsightsTab();
            showToast('Page scan refreshed!', 'success');
        });

        // Export listeners
        hudContainer.querySelector('#btn-export-md').addEventListener('click', () => {
            triggerExport('md');
        });
        hudContainer.querySelector('#btn-export-json').addEventListener('click', () => {
            triggerExport('json');
        });
        hudContainer.querySelector('#btn-export-spec-ts').addEventListener('click', () => {
            triggerExport('spec-ts');
        });
    }

    function triggerExport(format) {
        const scan = state.scanData || scanFullPage();
        const safeTitle = (document.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (format === 'md') {
            const mdContent = formatMarkdownDossier(scan);
            downloadFile(mdContent, `AutoScope_${safeTitle}_Automation_Dossier.md`, 'text/markdown');
            showToast('Downloaded Markdown Automation Dossier!', 'success');
        } else if (format === 'json') {
            const jsonContent = JSON.stringify(scan, null, 2);
            downloadFile(jsonContent, `AutoScope_${safeTitle}_Spec.json`, 'application/json');
            showToast('Downloaded Automation Spec JSON!', 'success');
        } else if (format === 'spec-ts') {
            const tsContent = generatePlaywrightTestScript(scan);
            downloadFile(tsContent, `AutoScope_${safeTitle}.spec.ts`, 'text/typescript');
            showToast('Downloaded Playwright test.spec.ts!', 'success');
        }
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

    function updateInsightsTab() {
        const scan = state.scanData || scanFullPage();
        hudContainer.querySelector('#stat-inputs').textContent = scan.inputs.length;
        hudContainer.querySelector('#stat-buttons').textContent = scan.actions.length;
        hudContainer.querySelector('#stat-forms').textContent = scan.forms.length;
        hudContainer.querySelector('#stat-iframes').textContent = scan.iframes.length;

        const chipsList = hudContainer.querySelector('#autoscope-tech-chips-list');
        chipsList.innerHTML = '';
        if (scan.context.frameworks.length > 0) {
            scan.context.frameworks.forEach(f => {
                const chip = document.createElement('span');
                chip.className = 'autoscope-tech-chip';
                chip.textContent = `⚡ ${f.name}`;
                chipsList.appendChild(chip);
            });
        } else {
            chipsList.innerHTML = '<span class="autoscope-hint">Vanilla HTML / Native DOM</span>';
        }
    }

    function updateInspectorView(el) {
        if (!hudContainer) return;

        const empty = hudContainer.querySelector('#autoscope-inspector-empty');
        const details = hudContainer.querySelector('#autoscope-inspector-details');

        if (!el) {
            empty.style.display = 'block';
            details.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        details.style.display = 'block';

        const info = extractElementDetails(el);
        hudContainer.querySelector('#autoscope-el-tag').textContent = `<${info.tag}>`;
        hudContainer.querySelector('#autoscope-el-dim').textContent = `${info.dimensions.width} × ${info.dimensions.height} px`;
        hudContainer.querySelector('#autoscope-el-role').textContent = `role: ${info.role}`;

        hudContainer.querySelector('#autoscope-el-pw').textContent = info.playwright.locator;
        hudContainer.querySelector('#autoscope-el-css').textContent = info.css;
        hudContainer.querySelector('#autoscope-el-xpath').textContent = info.xpath;
    }

    function highlightElement(el) {
        if (!el || el === hudContainer || hudContainer?.contains(el) || el === highlightOverlay || el === badgeOverlay) {
            hideHighlight();
            return;
        }

        setupDomUI();
        const rect = el.getBoundingClientRect();

        highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
        highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
        highlightOverlay.style.width = `${rect.width}px`;
        highlightOverlay.style.height = `${rect.height}px`;
        highlightOverlay.style.display = 'block';

        // Position badge
        badgeOverlay.textContent = `${el.tagName.toLowerCase()} | ${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
        let badgeTop = rect.top + window.scrollY - 24;
        if (badgeTop < window.scrollY) badgeTop = rect.top + window.scrollY + rect.height + 4;
        badgeOverlay.style.top = `${badgeTop}px`;
        badgeOverlay.style.left = `${rect.left + window.scrollX}px`;
        badgeOverlay.style.display = 'block';
    }

    function hideHighlight() {
        if (highlightOverlay) highlightOverlay.style.display = 'none';
        if (badgeOverlay) badgeOverlay.style.display = 'none';
    }

    function toggleHUD(forceState) {
        state.hudVisible = forceState !== undefined ? forceState : !state.hudVisible;
        setupDomUI();
        hudContainer.style.display = state.hudVisible ? 'flex' : 'none';

        if (state.hudVisible) {
            updateInsightsTab();
            enableInspectMode();
        } else {
            disableInspectMode();
            hideHighlight();
        }
        return state.hudVisible;
    }

    // --- Mouse & Keyboard Event Handlers ---
    function onMouseMove(e) {
        if (!state.inspectMode) return;
        const target = e.target;
        if (hudContainer && (target === hudContainer || hudContainer.contains(target))) return;

        state.currentElement = target;
        highlightElement(target);
        updateInspectorView(target);
    }

    function onClick(e) {
        if (!state.inspectMode) return;
        const target = e.target;
        if (hudContainer && (target === hudContainer || hudContainer.contains(target))) return;

        e.preventDefault();
        e.stopPropagation();

        state.pinnedElement = target;
        state.currentElement = target;
        highlightElement(target);
        updateInspectorView(target);

        const details = extractElementDetails(target);
        showToast(`📍 Selected <${details.tag}> (${details.playwright.locator})`, 'info');
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            if (state.inspectMode) {
                disableInspectMode();
                showToast('Inspect mode deactivated (Esc)', 'info');
            } else {
                enableInspectMode();
                showToast('Inspect mode activated', 'info');
            }
        }
    }

    function enableInspectMode() {
        state.inspectMode = true;
        setupDomUI();
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);

        const badge = hudContainer?.querySelector('#autoscope-status-badge');
        if (badge) {
            badge.textContent = 'Inspect Active';
            badge.classList.remove('paused');
        }
    }

    function disableInspectMode() {
        state.inspectMode = false;
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onClick, true);
        hideHighlight();

        const badge = hudContainer?.querySelector('#autoscope-status-badge');
        if (badge) {
            badge.textContent = 'Inspect Paused';
            badge.classList.add('paused');
        }
    }

    // --- Message Listener for Chrome Extension Popup ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleInspect') {
            const isNowActive = toggleHUD();
            sendResponse({ active: isNowActive });
        } else if (request.action === 'scanPage') {
            const scanData = scanFullPage();
            const md = formatMarkdownDossier(scanData);
            sendResponse({
                success: true,
                data: {
                    markdown: md,
                    count: scanData.inputs.length + scanData.actions.length,
                    title: scanData.context.title,
                    frameworks: scanData.context.frameworks,
                    metrics: {
                        inputs: scanData.inputs.length,
                        actions: scanData.actions.length,
                        forms: scanData.forms.length,
                        iframes: scanData.iframes.length
                    }
                }
            });
        } else if (request.action === 'exportArtifact') {
            const scanData = state.scanData || scanFullPage();
            if (request.format === 'json') {
                sendResponse({
                    success: true,
                    content: JSON.stringify(scanData, null, 2),
                    filename: `AutoScope_${(document.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_Spec.json`,
                    mimeType: 'application/json'
                });
            } else if (request.format === 'spec-ts') {
                sendResponse({
                    success: true,
                    content: generatePlaywrightTestScript(scanData),
                    filename: `AutoScope_${(document.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.spec.ts`,
                    mimeType: 'text/typescript'
                });
            }
        }
        return true;
    });

    // Expose engine instance
    window.__autoscopeEngine = {
        scanFullPage,
        formatMarkdownDossier,
        toggleHUD,
        enableInspectMode,
        disableInspectMode
    };
})();
