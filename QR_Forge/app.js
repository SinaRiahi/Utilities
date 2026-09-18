/**
 * QR Forge — Complete QR Code Design Studio, Batch Generator, & Scanner
 * 100% Client-side, zero network leaks.
 */

(function () {
    'use strict';

    // ── Built-in Preset SVG Icons ──────────────────────────────────
    const SVG_ICONS = {
        globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.93 9h-3.18a15.65 15.65 0 0 0-1.38-5.18A8.04 8.04 0 0 1 19.93 11zM12 4a13.9 13.9 0 0 1 2.14 7H9.86A13.9 13.9 0 0 1 12 4zm-5.37 1.82A15.65 15.65 0 0 0 5.25 11H2.07a8.04 8.04 0 0 1 4.56-5.18zM2.07 13h3.18a15.65 15.65 0 0 0 1.38 5.18A8.04 8.04 0 0 1 2.07 13zM12 20a13.9 13.9 0 0 1-2.14-7h4.28A13.9 13.9 0 0 1 12 20zm5.37-1.82a15.65 15.65 0 0 0 1.38-5.18h3.18a8.04 8.04 0 0 1-4.56 5.18z"/></svg>',
        wifi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A17.9 17.9 0 0 0 12 4zm0 4c3.34 0 6.37 1.35 8.57 3.54L12 20.12 3.43 11.54A11.94 11.94 0 0 1 12 8zm0 4c2.21 0 4.21.9 5.66 2.34L12 19.99 6.34 14.34A7.95 7.95 0 0 1 12 12z"/></svg>',
        github: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>',
        twitter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
        youtube: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e03131"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2b8a3e"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.11-.23-.17-.48-.3z"/></svg>',
        email: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a1a2e"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>',
        bitcoin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f76707"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.97-2.45-2.63-3.03l.54-2.15-1.3-.33-.52 2.1c-.34-.09-.7-.17-1.05-.25l.53-2.11-1.31-.33-.53 2.14c-.29-.07-.57-.14-.84-.21l-1.81-.45-.35 1.41s.97.22.95.24c.53.13.63.49.61.77l-.61 2.47c.04.01.08.02.13.04-.04-.01-.09-.03-.13-.04l-.86 3.46c-.07.16-.23.41-.6.31.02.03-.95-.24-.95-.24l-.65 1.51 1.71.43c.32.08.63.16.94.24l-.54 2.19 1.3.32.54-2.16c.36.1.7.19 1.05.28l-.54 2.14 1.31.33.54-2.18c2.23.42 3.91.25 4.62-1.76.57-1.62-.03-2.55-1.2-3.16.85-.2 1.5-.76 1.67-1.92zm-3 4.19c-.4 1.62-3.13.74-4.01.52l.72-2.87c.88.22 3.7.66 3.29 2.35zm.41-4.22c-.37 1.47-2.64.72-3.37.54l.65-2.61c.73.18 3.09.53 2.72 2.07z"/></svg>',
        shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4c6ef5"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fab005"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
    };

    function svgToDataUri(svgString) {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    }

    // ── QR Forge Master State ───────────────────────────────────────
    const State = {
        view: 'studio',
        type: 'url',
        dots: 'square',
        cornerSquare: 'square',
        cornerDot: 'square',
        colorMode: 'solid',
        gradientAngle: 45,
        primaryColor: '#1a1a2e',
        secondaryColor: '#4c6ef5',
        bgColor: '#ffffff',
        transparentBg: false,
        customCornerColors: false,
        cornerSquareColor: '#4c6ef5',
        cornerDotColor: '#1a1a2e',
        logoPreset: 'none',
        customLogoUri: null,
        logoSize: 0.30,
        logoMargin: 4,
        logoClearBg: true,
        frameStyle: 'none',
        frameText: 'SCAN ME',
        frameBgColor: '#4c6ef5',
        frameTextColor: '#ffffff',
        eccLevel: 'Q',
        margin: 10,
        resolution: 1024,
        cameraStream: null,
        batchItems: [],
        savedTemplates: []
    };

    let qrCodeInstance = null;

    // ── Theme Manager ───────────────────────────────────────────────
    function initTheme() {
        const savedTheme = localStorage.getItem('utilities_theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        applyTheme(theme);

        document.getElementById('btnThemeToggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('utilities_theme', next);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        if (theme === 'dark') {
            icon.textContent = '☀️';
            label.textContent = 'Light';
        } else {
            icon.textContent = '🌙';
            label.textContent = 'Dark';
        }
    }

    // ── Toast Notifications ─────────────────────────────────────────
    function showToast(msg, duration = 2400) {
        const toast = document.getElementById('appToast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // ── View Navigation ─────────────────────────────────────────────
    function initNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetView = tab.getAttribute('data-view');
                switchView(targetView);
            });
        });
    }

    function switchView(viewName) {
        State.view = viewName;
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-view') === viewName);
        });
        document.querySelectorAll('.view-section').forEach(s => {
            s.classList.remove('active');
        });

        const targetSection = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (targetSection) targetSection.classList.add('active');

        // Stop camera if leaving scanner
        if (viewName !== 'scanner' && State.cameraStream) {
            stopCamera();
        }

        if (viewName === 'saved') {
            renderSavedTemplates();
        }
    }

    // ── Payload Compiler ────────────────────────────────────────────
    function compilePayload() {
        switch (State.type) {
            case 'url': {
                let url = (document.getElementById('urlInput').value || '').trim();
                if (!url) url = 'https://github.com';
                const src = (document.getElementById('utmSource').value || '').trim();
                const med = (document.getElementById('utmMedium').value || '').trim();
                const cam = (document.getElementById('utmCampaign').value || '').trim();
                const cnt = (document.getElementById('utmContent').value || '').trim();

                const params = new URLSearchParams();
                if (src) params.set('utm_source', src);
                if (med) params.set('utm_medium', med);
                if (cam) params.set('utm_campaign', cam);
                if (cnt) params.set('utm_content', cnt);

                const queryString = params.toString();
                if (queryString) {
                    url += (url.includes('?') ? '&' : '?') + queryString;
                }
                return url;
            }
            case 'wifi': {
                const ssid = document.getElementById('wifiSsid').value || 'MyWiFi';
                const enc = document.getElementById('wifiEncryption').value;
                const pwd = document.getElementById('wifiPassword').value || '';
                const hidden = document.getElementById('wifiHidden').checked;
                return `WIFI:T:${enc};S:${ssid};P:${pwd};H:${hidden};;`;
            }
            case 'vcard': {
                const first = document.getElementById('vcardFirst').value || '';
                const last = document.getElementById('vcardLast').value || '';
                const org = document.getElementById('vcardOrg').value || '';
                const title = document.getElementById('vcardTitle').value || '';
                const phone = document.getElementById('vcardPhone').value || '';
                const email = document.getElementById('vcardEmail').value || '';
                const url = document.getElementById('vcardUrl').value || '';
                return [
                    'BEGIN:VCARD',
                    'VERSION:3.0',
                    `N:${last};${first};;;`,
                    `FN:${first} ${last}`.trim(),
                    org ? `ORG:${org}` : '',
                    title ? `TITLE:${title}` : '',
                    phone ? `TEL;TYPE=CELL:${phone}` : '',
                    email ? `EMAIL:${email}` : '',
                    url ? `URL:${url}` : '',
                    'END:VCARD'
                ].filter(Boolean).join('\n');
            }
            case 'whatsapp': {
                const phone = (document.getElementById('waPhone').value || '').replace(/[^\d+]/g, '');
                const msg = document.getElementById('waMsg').value || '';
                return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
            }
            case 'email': {
                const target = (document.getElementById('emailTarget').value || '').trim();
                const subject = document.getElementById('emailSubject').value || '';
                const body = document.getElementById('emailBody').value || '';
                return `mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }
            case 'phone': {
                const phone = (document.getElementById('phoneTarget').value || '').trim();
                return `tel:${phone}`;
            }
            case 'sms': {
                const phone = (document.getElementById('smsTarget').value || '').trim();
                const msg = document.getElementById('smsMsg').value || '';
                return `sms:${phone}?body=${encodeURIComponent(msg)}`;
            }
            case 'event': {
                const title = document.getElementById('eventTitle').value || 'New Event';
                const loc = document.getElementById('eventLocation').value || '';
                const s = document.getElementById('eventStart').value;
                const e = document.getElementById('eventEnd').value;
                const formatTime = (iso) => (iso ? iso.replace(/[-:]/g, '') + '00' : '');
                return [
                    'BEGIN:VEVENT',
                    `SUMMARY:${title}`,
                    loc ? `LOCATION:${loc}` : '',
                    s ? `DTSTART:${formatTime(s)}` : '',
                    e ? `DTEND:${formatTime(e)}` : '',
                    'END:VEVENT'
                ].filter(Boolean).join('\n');
            }
            case 'geo': {
                const lat = document.getElementById('geoLat').value || '37.7749';
                const lng = document.getElementById('geoLng').value || '-122.4194';
                return `geo:${lat},${lng}?q=${lat},${lng}`;
            }
            case 'crypto': {
                const cur = document.getElementById('cryptoCurrency').value;
                const addr = (document.getElementById('cryptoAddress').value || '').trim();
                const amt = (document.getElementById('cryptoAmount').value || '').trim();
                let uri = `${cur}:${addr}`;
                if (amt) uri += `?amount=${amt}`;
                return uri;
            }
            case 'social': {
                const plat = document.getElementById('socialPlatform').value;
                const handle = (document.getElementById('socialHandle').value || '').replace(/^@/, '');
                const roots = {
                    github: 'https://github.com/',
                    twitter: 'https://x.com/',
                    instagram: 'https://instagram.com/',
                    linkedin: 'https://linkedin.com/in/',
                    youtube: 'https://youtube.com/@',
                    telegram: 'https://t.me/'
                };
                return (roots[plat] || 'https://') + handle;
            }
            case 'text':
            default: {
                return document.getElementById('textInput').value || 'Sample text';
            }
        }
    }

    // ── Build QRCodeStyling Options ─────────────────────────────────
    function getQrOptions(overrideWidth = 320, overrideHeight = 320) {
        const payload = compilePayload();

        // Dots color
        let dotsColorOption = {
            type: State.dots,
            color: State.primaryColor
        };

        if (State.colorMode === 'linear' || State.colorMode === 'radial') {
            dotsColorOption.gradient = {
                type: State.colorMode,
                rotation: (State.gradientAngle * Math.PI) / 180,
                colorStops: [
                    { offset: 0, color: State.primaryColor },
                    { offset: 1, color: State.secondaryColor }
                ]
            };
        }

        // Corner Square
        let cornersSquareOptions = {
            type: State.cornerSquare,
            color: State.customCornerColors ? State.cornerSquareColor : State.primaryColor
        };

        // Corner Dot
        let cornersDotOptions = {
            type: State.cornerDot,
            color: State.customCornerColors ? State.cornerDotColor : State.primaryColor
        };

        // Logo Image
        let logoImageUri = null;
        if (State.customLogoUri) {
            logoImageUri = State.customLogoUri;
        } else if (State.logoPreset !== 'none' && SVG_ICONS[State.logoPreset]) {
            logoImageUri = svgToDataUri(SVG_ICONS[State.logoPreset]);
        }

        // Auto-elevate ECC if logo is active
        let effectiveEcc = State.eccLevel;
        if (logoImageUri && (effectiveEcc === 'L' || effectiveEcc === 'M')) {
            effectiveEcc = 'H';
        }

        return {
            width: overrideWidth,
            height: overrideHeight,
            type: 'canvas',
            data: payload || 'https://github.com',
            margin: State.margin,
            qrOptions: {
                errorCorrectionLevel: effectiveEcc
            },
            dotsOptions: dotsColorOption,
            backgroundOptions: {
                color: State.transparentBg ? 'rgba(0,0,0,0)' : State.bgColor
            },
            cornersSquareOptions,
            cornersDotOptions,
            image: logoImageUri,
            imageOptions: {
                hideBackgroundDots: State.logoClearBg,
                imageSize: State.logoSize,
                margin: State.logoMargin,
                crossOrigin: 'anonymous'
            }
        };
    }

    // ── Frame Compositor ────────────────────────────────────────────
    // Draws the styled frame banner onto a composite canvas
    async function composeFramedCanvas(sourceCanvas, targetWidth, targetHeight) {
        if (State.frameStyle === 'none') {
            return sourceCanvas;
        }

        const composite = document.createElement('canvas');
        composite.width = targetWidth;
        composite.height = targetHeight;
        const ctx = composite.getContext('2d');

        const frameBg = State.frameBgColor || '#4c6ef5';
        const frameText = (State.frameText || 'SCAN ME').toUpperCase();
        const textColor = State.frameTextColor || '#ffffff';

        // Outer background
        ctx.fillStyle = State.transparentBg ? 'rgba(0,0,0,0)' : State.bgColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const bannerHeight = Math.round(targetHeight * 0.16);
        const qrSize = Math.round(targetHeight * 0.78);
        const qrX = Math.round((targetWidth - qrSize) / 2);

        if (State.frameStyle === 'bottom-badge') {
            const qrY = Math.round((targetHeight - bannerHeight - qrSize) / 2) + 4;
            ctx.drawImage(sourceCanvas, qrX, qrY, qrSize, qrSize);

            // Draw bottom banner
            const bannerY = targetHeight - bannerHeight - 8;
            const radius = 8;
            ctx.fillStyle = frameBg;
            ctx.beginPath();
            ctx.roundRect(16, bannerY, targetWidth - 32, bannerHeight, radius);
            ctx.fill();

            // Banner Text
            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.round(bannerHeight * 0.42)}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(frameText, targetWidth / 2, bannerY + bannerHeight / 2);

        } else if (State.frameStyle === 'top-badge') {
            // Draw top banner
            const bannerY = 10;
            const radius = 8;
            ctx.fillStyle = frameBg;
            ctx.beginPath();
            ctx.roundRect(16, bannerY, targetWidth - 32, bannerHeight, radius);
            ctx.fill();

            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.round(bannerHeight * 0.42)}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(frameText, targetWidth / 2, bannerY + bannerHeight / 2);

            const qrY = bannerY + bannerHeight + 10;
            ctx.drawImage(sourceCanvas, qrX, qrY, qrSize, qrSize);

        } else if (State.frameStyle === 'box-border') {
            const borderWidth = 12;
            ctx.strokeStyle = frameBg;
            ctx.lineWidth = borderWidth;
            ctx.strokeRect(borderWidth / 2, borderWidth / 2, targetWidth - borderWidth, targetHeight - borderWidth);
            ctx.drawImage(sourceCanvas, borderWidth + 6, borderWidth + 6, targetWidth - (borderWidth * 2 + 12), targetHeight - (borderWidth * 2 + 12));
        }

        return composite;
    }

    // ── Live Render Update ──────────────────────────────────────────
    let renderDebounceTimer = null;

    function requestQrRender() {
        clearTimeout(renderDebounceTimer);
        renderDebounceTimer = setTimeout(renderLiveQr, 60);
    }

    async function renderLiveQr() {
        const holder = document.getElementById('qrHolder');
        if (!holder) return;

        const options = getQrOptions(320, 320);

        // Update payload inspector
        const payloadStr = options.data;
        document.getElementById('payloadInspectCode').textContent = payloadStr;
        document.getElementById('charCountBadge').textContent = `${payloadStr.length} characters`;

        // Update scannability badge
        const badge = document.getElementById('scannabilityBadge');
        if (payloadStr.length > 500) {
            badge.className = 'scan-status-badge warning';
            badge.textContent = `⚠️ High Density (${payloadStr.length} chars) — Ensure High Contrast`;
        } else {
            badge.className = 'scan-status-badge';
            badge.textContent = `✓ Optimal Scannability (ECC: ${options.qrOptions.errorCorrectionLevel})`;
        }

        try {
            if (!qrCodeInstance) {
                if (typeof QRCodeStyling !== 'undefined') {
                    qrCodeInstance = new QRCodeStyling(options);
                    holder.innerHTML = '';
                    qrCodeInstance.append(holder);
                }
            } else {
                qrCodeInstance.update(options);
            }

            // If framed, wrap or overlay preview
            if (State.frameStyle !== 'none') {
                setTimeout(async () => {
                    const rawCanvas = holder.querySelector('canvas');
                    if (rawCanvas) {
                        const framed = await composeFramedCanvas(rawCanvas, 320, 320);
                        holder.innerHTML = '';
                        holder.appendChild(framed);
                    }
                }, 80);
            }
        } catch (err) {
            console.error('QR Render Error:', err);
        }
    }

    // ── Setup UI Event Listeners ────────────────────────────────────
    function initStudioControls() {
        // 1. Content Type Pills
        const pills = document.querySelectorAll('.type-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                State.type = pill.getAttribute('data-type');

                // Toggle sub-forms
                document.querySelectorAll('.template-form').forEach(f => f.classList.add('hidden'));
                const activeForm = document.getElementById(`form-${State.type}`);
                if (activeForm) activeForm.classList.remove('hidden');

                requestQrRender();
            });
        });

        // Form Inputs change listener
        const formInputs = document.querySelectorAll('#templateForms input, #templateForms textarea, #templateForms select');
        formInputs.forEach(input => {
            input.addEventListener('input', requestQrRender);
        });

        // Use GPS button
        document.getElementById('btnUseCurrentLocation').addEventListener('click', () => {
            if ('geolocation' in navigator) {
                showToast('Fetching GPS coordinates...');
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        document.getElementById('geoLat').value = pos.coords.latitude.toFixed(6);
                        document.getElementById('geoLng').value = pos.coords.longitude.toFixed(6);
                        requestQrRender();
                        showToast('Location coordinates updated!');
                    },
                    err => {
                        showToast(`GPS Error: ${err.message}`);
                    }
                );
            } else {
                showToast('Geolocation is not supported by your browser.');
            }
        });

        // 2. Patterns & Shapes
        setupOptionCards('dotTypeGrid', val => { State.dots = val; requestQrRender(); });
        setupOptionCards('cornerSquareGrid', val => { State.cornerSquare = val; requestQrRender(); });
        setupOptionCards('cornerDotGrid', val => { State.cornerDot = val; requestQrRender(); });

        // 3. Colors & Gradients
        const colorMode = document.getElementById('colorMode');
        const angleCol = document.getElementById('gradientAngleCol');
        const secColorCol = document.getElementById('secondaryColorCol');
        const angleSlider = document.getElementById('gradientAngle');
        const angleVal = document.getElementById('angleVal');

        colorMode.addEventListener('change', () => {
            State.colorMode = colorMode.value;
            const isGrad = State.colorMode === 'linear' || State.colorMode === 'radial';
            angleCol.classList.toggle('hidden', !isGrad);
            secColorCol.classList.toggle('hidden', !isGrad);
            requestQrRender();
        });

        angleSlider.addEventListener('input', () => {
            State.gradientAngle = parseInt(angleSlider.value, 10);
            angleVal.textContent = `${State.gradientAngle}°`;
            requestQrRender();
        });

        syncColorInputs('primaryColor', 'primaryColorHex', val => { State.primaryColor = val; requestQrRender(); });
        syncColorInputs('secondaryColor', 'secondaryColorHex', val => { State.secondaryColor = val; requestQrRender(); });
        syncColorInputs('bgColor', 'bgColorHex', val => { State.bgColor = val; requestQrRender(); });

        document.getElementById('transparentBg').addEventListener('change', e => {
            State.transparentBg = e.target.checked;
            requestQrRender();
        });

        // Custom corner colors
        const customCornerToggle = document.getElementById('customCornerColors');
        const cornerWrap = document.getElementById('cornerColorsWrap');
        customCornerToggle.addEventListener('change', e => {
            State.customCornerColors = e.target.checked;
            cornerWrap.classList.toggle('hidden', !State.customCornerColors);
            requestQrRender();
        });
        syncColorInputs('cornerSquareColor', 'cornerSquareColorHex', val => { State.cornerSquareColor = val; requestQrRender(); });
        syncColorInputs('cornerDotColor', 'cornerDotColorHex', val => { State.cornerDotColor = val; requestQrRender(); });

        // Palette presets
        const palettes = {
            classic: { primary: '#1a1a2e', secondary: '#495057', bg: '#ffffff' },
            indigo: { primary: '#4c6ef5', secondary: '#15aabf', bg: '#ffffff' },
            emerald: { primary: '#099268', secondary: '#20c997', bg: '#ffffff' },
            sunset: { primary: '#e03131', secondary: '#f76707', bg: '#ffffff' },
            midnight: { primary: '#1864ab', secondary: '#fcc419', bg: '#ffffff' },
            purple: { primary: '#7950f2', secondary: '#be4bdb', bg: '#ffffff' }
        };

        document.querySelectorAll('.palette-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const key = chip.getAttribute('data-p');
                const p = palettes[key];
                if (p) {
                    setColorValue('primaryColor', 'primaryColorHex', p.primary);
                    setColorValue('secondaryColor', 'secondaryColorHex', p.secondary);
                    setColorValue('bgColor', 'bgColorHex', p.bg);
                    State.primaryColor = p.primary;
                    State.secondaryColor = p.secondary;
                    State.bgColor = p.bg;
                    requestQrRender();
                    showToast(`Applied ${chip.textContent.trim()} palette`);
                }
            });
        });

        // 4. Logo & Watermark
        const iconBtns = document.querySelectorAll('.icon-preset-btn');
        iconBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                iconBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                State.logoPreset = btn.getAttribute('data-icon');
                State.customLogoUri = null;
                document.getElementById('logoControlsWrap').classList.toggle('hidden', State.logoPreset === 'none');
                requestQrRender();
            });
        });

        // Upload custom logo
        const logoFileInput = document.getElementById('logoUploadInput');
        logoFileInput.addEventListener('change', () => {
            const file = logoFileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = ev => {
                    State.customLogoUri = ev.target.result;
                    State.logoPreset = 'custom';
                    iconBtns.forEach(b => b.classList.remove('active'));
                    document.getElementById('logoControlsWrap').classList.remove('hidden');
                    requestQrRender();
                    showToast('Custom logo applied!');
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('btnRemoveLogo').addEventListener('click', () => {
            State.logoPreset = 'none';
            State.customLogoUri = null;
            iconBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-icon') === 'none'));
            document.getElementById('logoControlsWrap').classList.add('hidden');
            logoFileInput.value = '';
            requestQrRender();
            showToast('Logo removed');
        });

        const logoSizeSlider = document.getElementById('logoSize');
        logoSizeSlider.addEventListener('input', () => {
            State.logoSize = parseFloat(logoSizeSlider.value) / 100;
            document.getElementById('logoSizeVal').textContent = `${logoSizeSlider.value}%`;
            requestQrRender();
        });

        const logoMarginSlider = document.getElementById('logoMargin');
        logoMarginSlider.addEventListener('input', () => {
            State.logoMargin = parseInt(logoMarginSlider.value, 10);
            document.getElementById('logoMarginVal').textContent = `${State.logoMargin}px`;
            requestQrRender();
        });

        document.getElementById('logoClearBg').addEventListener('change', e => {
            State.logoClearBg = e.target.checked;
            requestQrRender();
        });

        // 5. CTA Frames
        setupOptionCards('frameStyleGrid', val => {
            State.frameStyle = val;
            document.getElementById('frameControlsWrap').classList.toggle('hidden', val === 'none');
            requestQrRender();
        });

        document.getElementById('frameText').addEventListener('input', e => {
            State.frameText = e.target.value;
            requestQrRender();
        });

        syncColorInputs('frameBgColor', 'frameBgColorHex', val => { State.frameBgColor = val; requestQrRender(); });
        syncColorInputs('frameTextColor', 'frameTextColorHex', val => { State.frameTextColor = val; requestQrRender(); });

        // 6. Technical Precision
        document.getElementById('eccLevel').addEventListener('change', e => {
            State.eccLevel = e.target.value;
            requestQrRender();
        });

        const marginSlider = document.getElementById('qrMargin');
        marginSlider.addEventListener('input', () => {
            State.margin = parseInt(marginSlider.value, 10);
            document.getElementById('marginVal').textContent = `${State.margin}px`;
            requestQrRender();
        });

        // Resolution selector
        document.getElementById('exportResolution').addEventListener('change', e => {
            State.resolution = parseInt(e.target.value, 10);
        });

        // 7. Action Deck Buttons
        document.getElementById('btnDownloadPng').addEventListener('click', downloadPng);
        document.getElementById('btnDownloadSvg').addEventListener('click', downloadSvg);
        document.getElementById('btnCopyClipboard').addEventListener('click', copyToClipboard);
        document.getElementById('btnPrint').addEventListener('click', printQr);
        document.getElementById('btnSaveTemplate').addEventListener('click', saveTemplate);

        document.getElementById('btnCopyPayload').addEventListener('click', () => {
            const raw = document.getElementById('payloadInspectCode').textContent;
            navigator.clipboard.writeText(raw).then(() => showToast('Payload copied to clipboard!'));
        });

        // Reset all
        document.getElementById('btnResetAll').addEventListener('click', () => {
            if (confirm('Reset all QR Forge settings to default?')) {
                resetAllSettings();
            }
        });
    }

    function setupOptionCards(containerId, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = container.querySelectorAll('.option-card');
        cards.forEach(c => {
            c.addEventListener('click', () => {
                cards.forEach(x => x.classList.remove('active'));
                c.classList.add('active');
                onChange(c.getAttribute('data-val'));
            });
        });
    }

    function syncColorInputs(pickerId, hexId, onChange) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexId);
        if (!picker || !hex) return;

        picker.addEventListener('input', () => {
            hex.value = picker.value;
            onChange(picker.value);
        });

        hex.addEventListener('change', () => {
            if (/^#[0-9A-F]{6}$/i.test(hex.value)) {
                picker.value = hex.value;
                onChange(hex.value);
            }
        });
    }

    function setColorValue(pickerId, hexId, value) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexId);
        if (picker && hex) {
            picker.value = value;
            hex.value = value;
        }
    }

    function resetAllSettings() {
        State.type = 'url';
        State.dots = 'square';
        State.cornerSquare = 'square';
        State.cornerDot = 'square';
        State.colorMode = 'solid';
        State.primaryColor = '#1a1a2e';
        State.secondaryColor = '#4c6ef5';
        State.bgColor = '#ffffff';
        State.transparentBg = false;
        State.customCornerColors = false;
        State.logoPreset = 'none';
        State.customLogoUri = null;
        State.frameStyle = 'none';
        State.eccLevel = 'Q';
        State.margin = 10;
        State.resolution = 1024;

        // Reset UI inputs
        document.getElementById('urlInput').value = 'https://github.com';
        document.getElementById('colorMode').value = 'solid';
        setColorValue('primaryColor', 'primaryColorHex', '#1a1a2e');
        setColorValue('bgColor', 'bgColorHex', '#ffffff');
        document.getElementById('transparentBg').checked = false;
        document.getElementById('customCornerColors').checked = false;
        document.getElementById('cornerColorsWrap').classList.add('hidden');
        document.getElementById('logoControlsWrap').classList.add('hidden');
        document.getElementById('frameControlsWrap').classList.add('hidden');
        document.getElementById('eccLevel').value = 'Q';
        document.getElementById('qrMargin').value = 10;
        document.getElementById('marginVal').textContent = '10px';

        document.querySelectorAll('.type-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-type') === 'url'));
        document.querySelectorAll('.template-form').forEach(f => f.classList.add('hidden'));
        document.getElementById('form-url').classList.remove('hidden');

        document.querySelectorAll('#dotTypeGrid .option-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === 'square'));
        document.querySelectorAll('#cornerSquareGrid .option-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === 'square'));
        document.querySelectorAll('#cornerDotGrid .option-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === 'square'));
        document.querySelectorAll('#frameStyleGrid .option-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === 'none'));
        document.querySelectorAll('.icon-preset-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-icon') === 'none'));

        requestQrRender();
        showToast('Settings reset to default');
    }

    // ── Export Suite ────────────────────────────────────────────────
    async function generateHighResCanvas(targetSize = 1024) {
        const options = getQrOptions(targetSize, targetSize);
        const tempStyling = new QRCodeStyling(options);
        const blob = await tempStyling.getRawData('png');
        const img = new Image();
        const url = URL.createObjectURL(blob);

        await new Promise(resolve => {
            img.onload = resolve;
            img.src = url;
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetSize;
        tempCanvas.height = targetSize;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        URL.revokeObjectURL(url);

        return await composeFramedCanvas(tempCanvas, targetSize, targetSize);
    }

    async function downloadPng() {
        showToast('Preparing high-res PNG...');
        try {
            const canvas = await generateHighResCanvas(State.resolution);
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `qr_forge_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            showToast(`Downloaded PNG (${State.resolution}×${State.resolution} px)`);
        } catch (err) {
            console.error(err);
            showToast('Export failed.');
        }
    }

    async function downloadSvg() {
        if (State.frameStyle !== 'none') {
            showToast('SVG download does not include framed banners. Downloading vector QR core.');
        }
        try {
            const options = getQrOptions(1024, 1024);
            options.type = 'svg';
            const svgStyling = new QRCodeStyling(options);
            await svgStyling.download({ name: `qr_forge_${Date.now()}`, extension: 'svg' });
            showToast('Downloaded pure vector SVG!');
        } catch (err) {
            console.error(err);
            showToast('SVG Export failed.');
        }
    }

    async function copyToClipboard() {
        try {
            const canvas = await generateHighResCanvas(1024);
            canvas.toBlob(async blob => {
                if (navigator.clipboard && navigator.clipboard.write) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast('QR Code copied to clipboard as PNG image!');
                } else {
                    showToast('Clipboard API not supported in this browser.');
                }
            }, 'image/png');
        } catch (err) {
            console.error(err);
            showToast('Could not copy image.');
        }
    }

    async function printQr() {
        try {
            const canvas = await generateHighResCanvas(800);
            const dataUrl = canvas.toDataURL('image/png');
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print QR Code — QR Forge</title>
                    <style>
                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        img { max-width: 480px; height: auto; border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
                        p { margin-top: 16px; color: #555; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <img src="${dataUrl}" alt="QR Code">
                    <p>Generated by QR Forge</p>
                    <script>
                        window.onload = function() { window.print(); window.close(); };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (err) {
            console.error(err);
            showToast('Print failed.');
        }
    }

    // ── Saved Templates & History ───────────────────────────────────
    function saveTemplate() {
        try {
            const rawCanvas = document.getElementById('qrHolder').querySelector('canvas');
            const thumbnail = rawCanvas ? rawCanvas.toDataURL('image/png') : '';
            const payload = compilePayload();

            const item = {
                id: 'tmpl_' + Date.now(),
                name: `${State.type.toUpperCase()}: ${payload.slice(0, 24)}...`,
                payload,
                type: State.type,
                dots: State.dots,
                cornerSquare: State.cornerSquare,
                cornerDot: State.cornerDot,
                primaryColor: State.primaryColor,
                bgColor: State.bgColor,
                thumbnail,
                timestamp: new Date().toLocaleDateString()
            };

            const list = JSON.parse(localStorage.getItem('qr_forge_saved') || '[]');
            list.unshift(item);
            if (list.length > 25) list.pop();
            localStorage.setItem('qr_forge_saved', JSON.stringify(list));

            showToast('Saved to your QR Templates!');
        } catch (err) {
            console.error(err);
            showToast('Failed to save template.');
        }
    }

    function renderSavedTemplates() {
        const grid = document.getElementById('savedTemplatesGrid');
        const empty = document.getElementById('savedEmptyState');
        const list = JSON.parse(localStorage.getItem('qr_forge_saved') || '[]');

        if (list.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = list.map((item, idx) => `
            <div class="batch-item-card">
                <img src="${item.thumbnail}" alt="Thumbnail">
                <div class="batch-item-label" title="${item.payload}">${item.name}</div>
                <div class="flex-between" style="width: 100%; margin-top: 4px;">
                    <button class="btn-tool btn-load-tmpl" data-idx="${idx}" style="font-size: 11px; padding: 2px 6px;">Restore</button>
                    <button class="btn-tool btn-del-tmpl" data-idx="${idx}" style="font-size: 11px; padding: 2px 6px; color: var(--danger);">Delete</button>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.btn-del-tmpl').forEach(btn => {
            btn.addEventListener('click', e => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                list.splice(idx, 1);
                localStorage.setItem('qr_forge_saved', JSON.stringify(list));
                renderSavedTemplates();
                showToast('Deleted template');
            });
        });

        grid.querySelectorAll('.btn-load-tmpl').forEach(btn => {
            btn.addEventListener('click', e => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                const item = list[idx];
                if (item) {
                    State.dots = item.dots || 'square';
                    State.cornerSquare = item.cornerSquare || 'square';
                    State.cornerDot = item.cornerDot || 'square';
                    State.primaryColor = item.primaryColor || '#1a1a2e';
                    State.bgColor = item.bgColor || '#ffffff';
                    setColorValue('primaryColor', 'primaryColorHex', State.primaryColor);
                    setColorValue('bgColor', 'bgColorHex', State.bgColor);
                    switchView('studio');
                    requestQrRender();
                    showToast('Template restored to Designer!');
                }
            });
        });
    }

    document.getElementById('btnClearHistory').addEventListener('click', () => {
        if (confirm('Clear all saved templates?')) {
            localStorage.removeItem('qr_forge_saved');
            renderSavedTemplates();
            showToast('History cleared');
        }
    });

    // ── Batch QR Generator Engine ───────────────────────────────────
    function initBatchGenerator() {
        const dropzone = document.getElementById('batchDropzone');
        const fileInput = document.getElementById('batchFileInput');
        const textarea = document.getElementById('batchTextarea');
        const btnRun = document.getElementById('btnRunBatch');
        const btnZip = document.getElementById('btnDownloadZip');
        const btnSample = document.getElementById('btnLoadBatchSample');

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleBatchFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleBatchFile(fileInput.files[0]);
        });

        function handleBatchFile(file) {
            const reader = new FileReader();
            reader.onload = ev => {
                textarea.value = ev.target.result;
                showToast(`Loaded ${file.name}`);
            };
            reader.readAsText(file);
        }

        btnSample.addEventListener('click', () => {
            textarea.value = [
                'https://example.com/item/001-table-apple',
                'https://example.com/item/002-table-banana',
                'https://example.com/item/003-table-cherry',
                'https://example.com/item/004-table-durian',
                'https://example.com/item/005-table-elderberry'
            ].join('\n');
            showToast('Sample batch items loaded');
        });

        btnRun.addEventListener('click', runBatchGeneration);
        btnZip.addEventListener('click', downloadBatchZip);
    }

    async function runBatchGeneration() {
        const text = (document.getElementById('batchTextarea').value || '').trim();
        if (!text) {
            showToast('Please enter at least one URL or text item.');
            return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 500) {
            showToast('Max 500 items per batch.');
            return;
        }

        const prefix = (document.getElementById('batchPrefix').value || '').trim();
        const styleMode = document.getElementById('batchStyleMode').value;
        const progressWrap = document.getElementById('batchProgressWrap');
        const progressFill = document.getElementById('batchProgressFill');
        const statusText = document.getElementById('batchStatusText');
        const gallery = document.getElementById('batchGallery');
        const btnZip = document.getElementById('btnDownloadZip');

        progressWrap.style.display = 'block';
        statusText.style.display = 'block';
        gallery.innerHTML = '';
        btnZip.disabled = true;
        State.batchItems = [];

        for (let i = 0; i < lines.length; i++) {
            const rawVal = lines[i];
            const fullVal = prefix ? (prefix + rawVal) : rawVal;
            statusText.textContent = `Generating ${i + 1} of ${lines.length}...`;
            progressFill.style.width = `${Math.round(((i + 1) / lines.length) * 100)}%`;

            let batchOpt;
            if (styleMode === 'designer') {
                batchOpt = getQrOptions(400, 400);
                batchOpt.data = fullVal;
            } else {
                batchOpt = {
                    width: 400,
                    height: 400,
                    type: 'canvas',
                    data: fullVal,
                    margin: 8,
                    qrOptions: { errorCorrectionLevel: 'M' },
                    dotsOptions: { type: 'square', color: '#000000' },
                    backgroundOptions: { color: '#ffffff' }
                };
            }

            const tempStyling = new QRCodeStyling(batchOpt);
            const blob = await tempStyling.getRawData('png');
            const dataUrl = URL.createObjectURL(blob);

            State.batchItems.push({
                index: i + 1,
                label: rawVal,
                blob,
                dataUrl
            });

            // Append to gallery
            const card = document.createElement('div');
            card.className = 'batch-item-card';
            card.innerHTML = `
                <img src="${dataUrl}" alt="QR ${i + 1}">
                <div class="batch-item-label" title="${fullVal}">#${i + 1}: ${rawVal}</div>
                <a href="${dataUrl}" download="qr_${String(i + 1).padStart(3, '0')}.png" class="btn-tool" style="font-size: 11px; padding: 2px 8px; text-decoration: none;">Download</a>
            `;
            gallery.appendChild(card);

            // Yield frame
            await new Promise(r => setTimeout(r, 20));
        }

        statusText.textContent = `Complete! Generated ${lines.length} QR codes.`;
        btnZip.disabled = false;
        showToast(`Batch generation complete (${lines.length} codes)`);
    }

    async function downloadBatchZip() {
        if (!State.batchItems || State.batchItems.length === 0) return;
        if (typeof JSZip === 'undefined') {
            showToast('JSZip library not loaded.');
            return;
        }

        showToast('Packaging ZIP archive...');
        const zip = new JSZip();
        const folder = zip.folder('qr_forge_batch');

        State.batchItems.forEach(item => {
            const cleanLabel = item.label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
            const filename = `qr_${String(item.index).padStart(3, '0')}_${cleanLabel}.png`;
            folder.file(filename, item.blob);
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `qr_forge_batch_${Date.now()}.zip`;
        link.click();
        showToast('ZIP downloaded successfully!');
    }

    // ── QR Code Scanner Engine ──────────────────────────────────────
    function initScanner() {
        const btnToggleCam = document.getElementById('btnToggleCamera');
        const dropzone = document.getElementById('scannerDropzone');
        const fileInput = document.getElementById('scannerFileInput');

        btnToggleCam.addEventListener('click', toggleCamera);

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                decodeImageFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) decodeImageFile(fileInput.files[0]);
        });

        // Paste image from clipboard
        window.addEventListener('paste', e => {
            if (State.view !== 'scanner') return;
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    decodeImageFile(blob);
                    break;
                }
            }
        });

        // Result action buttons
        document.getElementById('btnCopyScanContent').addEventListener('click', () => {
            const content = document.getElementById('scanContentText').textContent;
            navigator.clipboard.writeText(content).then(() => showToast('Scanned text copied!'));
        });

        document.getElementById('btnOpenScanLink').addEventListener('click', () => {
            const url = document.getElementById('scanContentText').textContent.trim();
            if (/^https?:\/\//i.test(url)) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                showToast('Not a standard HTTP web link.');
            }
        });

        document.getElementById('btnLoadIntoDesigner').addEventListener('click', () => {
            const content = document.getElementById('scanContentText').textContent.trim();
            loadScannedIntoDesigner(content);
        });
    }

    async function toggleCamera() {
        if (State.cameraStream) {
            stopCamera();
        } else {
            startCamera();
        }
    }

    async function startCamera() {
        const video = document.getElementById('scannerVideo');
        const overlay = document.getElementById('scannerOverlay');
        const placeholder = document.getElementById('cameraPlaceholder');
        const btnIcon = document.getElementById('camBtnIcon');
        const btnLabel = document.getElementById('camBtnLabel');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            State.cameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            overlay.style.display = 'flex';
            placeholder.style.display = 'none';
            btnIcon.textContent = '⏹️';
            btnLabel.textContent = 'Stop Camera';
            await video.play();
            requestAnimationFrame(scanCameraFrame);
            showToast('Camera started — point at a QR code');
        } catch (err) {
            console.error('Camera access error:', err);
            showToast(`Camera error: ${err.message || 'Permission denied'}`);
        }
    }

    function stopCamera() {
        if (State.cameraStream) {
            State.cameraStream.getTracks().forEach(track => track.stop());
            State.cameraStream = null;
        }
        const video = document.getElementById('scannerVideo');
        const overlay = document.getElementById('scannerOverlay');
        const placeholder = document.getElementById('cameraPlaceholder');
        const btnIcon = document.getElementById('camBtnIcon');
        const btnLabel = document.getElementById('camBtnLabel');

        video.style.display = 'none';
        overlay.style.display = 'none';
        placeholder.style.display = 'block';
        btnIcon.textContent = '🎥';
        btnLabel.textContent = 'Start Camera';
    }

    function scanCameraFrame() {
        if (!State.cameraStream) return;
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });
                if (code && code.data) {
                    handleScanResult(code.data);
                    showToast('QR Code detected!');
                    stopCamera();
                    return;
                }
            }
        }
        requestAnimationFrame(scanCameraFrame);
    }

    function decodeImageFile(file) {
        if (!file) return;
        showToast('Scanning image...');
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) {
                        handleScanResult(code.data);
                        showToast('QR Code successfully decoded!');
                    } else {
                        showToast('No QR code found in this image.');
                    }
                }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function handleScanResult(data) {
        const emptyState = document.getElementById('scanEmptyState');
        const resultContainer = document.getElementById('scanResultContainer');
        const badge = document.getElementById('scanTypeBadge');
        const contentText = document.getElementById('scanContentText');
        const btnOpen = document.getElementById('btnOpenScanLink');

        emptyState.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        contentText.textContent = data;

        // Detect type
        if (/^https?:\/\//i.test(data)) {
            badge.textContent = 'Website URL';
            btnOpen.style.display = 'inline-flex';
        } else if (/^WIFI:/i.test(data)) {
            badge.textContent = 'Wi-Fi Network';
            btnOpen.style.display = 'none';
        } else if (/BEGIN:VCARD/i.test(data)) {
            badge.textContent = 'vCard Contact';
            btnOpen.style.display = 'none';
        } else if (/^mailto:/i.test(data)) {
            badge.textContent = 'Email';
            btnOpen.style.display = 'none';
        } else if (/^tel:/i.test(data)) {
            badge.textContent = 'Phone Call';
            btnOpen.style.display = 'none';
        } else {
            badge.textContent = 'Plain Text';
            btnOpen.style.display = 'none';
        }
    }

    function loadScannedIntoDesigner(data) {
        if (!data) return;
        switchView('studio');

        if (/^https?:\/\//i.test(data)) {
            document.querySelector('.type-pill[data-type="url"]').click();
            document.getElementById('urlInput').value = data;
        } else if (/^WIFI:/i.test(data)) {
            document.querySelector('.type-pill[data-type="wifi"]').click();
            const ssidMatch = data.match(/S:([^;]+);/);
            const pwdMatch = data.match(/P:([^;]+);/);
            if (ssidMatch) document.getElementById('wifiSsid').value = ssidMatch[1];
            if (pwdMatch) document.getElementById('wifiPassword').value = pwdMatch[1];
        } else {
            document.querySelector('.type-pill[data-type="text"]').click();
            document.getElementById('textInput').value = data;
        }

        requestQrRender();
        showToast('Loaded into Designer!');
    }

    // ── Boot ────────────────────────────────────────────────────────
    window.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initNavigation();
        initStudioControls();
        initBatchGenerator();
        initScanner();

        // Initial live render
        requestQrRender();
    });

})();
