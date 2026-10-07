/* "Share this page" overlay with a styled QR code of the page URL. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const CANONICAL = 'https://hackelle.github.io/slimmable-rsfms/';

  function pageUrl() {
    const l = location;
    const local = !/^https?:$/.test(l.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(l.hostname);
    return local ? CANONICAL : l.origin + l.pathname;
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Rounded-dot QR with rounded finder eyes and a cleared centre for the logo (error correction H).
  function qrSvg(text) {
    const qr = qrcode(0, 'H');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), q = 3, size = n + 2 * q;
    const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': 'QR code linking to ' + text });
    el('rect', { width: size, height: size, rx: 2.2, fill: '#ffffff' }, svg);
    const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const logo = Math.ceil(n * 0.22) | 1, l0 = (n - logo) / 2, l1 = l0 + logo;
    const inLogo = (r, c) => r >= l0 - 0.5 && r < l1 + 0.5 && c >= l0 - 0.5 && c < l1 + 0.5;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
        const x = c + q + 0.5, y = r + q + 0.5, rad = 0.43;
        d += `M${x - rad},${y}a${rad},${rad} 0 1,0 ${2 * rad},0a${rad},${rad} 0 1,0 ${-2 * rad},0`;
      }
    }
    el('path', { d, fill: '#0b2a2a' }, svg);
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
      const x = c + q, y = r + q;
      el('rect', { x: x + 0.5, y: y + 0.5, width: 6, height: 6, rx: 1.8, fill: 'none', stroke: '#0f6e5c', 'stroke-width': 1 }, svg);
      el('rect', { x: x + 2, y: y + 2, width: 3, height: 3, rx: 0.9, fill: '#0b2a2a' }, svg);
    });
    // centre badge: the site's "slimmed grid" mark
    const bx = l0 + q - 0.2, bs = logo + 0.4;
    el('rect', { x: bx, y: bx, width: bs, height: bs, rx: bs * 0.22, fill: '#0b2a2a' }, svg);
    const cell = bs / 4.4, pad = cell * 0.55;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const kept = i === 0 || j === 0;
      el('rect', {
        x: bx + pad + j * cell * 1.15, y: bx + pad + i * cell * 1.15, width: cell * 0.9, height: cell * 0.9, rx: cell * 0.2,
        fill: kept ? '#8fe3cc' : 'none', stroke: kept ? 'none' : '#8fe3cc', 'stroke-width': cell * 0.12,
        'stroke-dasharray': kept ? '' : `${cell * 0.18} ${cell * 0.14}`, opacity: kept ? 1 : 0.6
      }, svg);
    }
    return svg;
  }

  function build() {
    const url = pageUrl();
    const ov = document.createElement('div');
    ov.className = 'qr-overlay';
    ov.hidden = true;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'qr-title');
    ov.innerHTML = `
      <div class="qr-card">
        <button class="qr-close" type="button" aria-label="Close">×</button>
        <div class="qr-venue">NeurIPS 2026 · Sydney · Poster</div>
        <h2 id="qr-title">How Much of a Model Do We Need?</h2>
        <p class="qr-sub">Redundancy and Slimmability in Remote Sensing Foundation Models</p>
        <div class="qr-code"></div>
        <p class="qr-url"></p>
        <div class="qr-actions">
          <button type="button" class="qr-btn" data-act="copy">Copy link</button>
          <button type="button" class="qr-btn primary" data-act="share" hidden>Share…</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.qr-code').appendChild(qrSvg(url));
    ov.querySelector('.qr-url').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const share = ov.querySelector('[data-act="share"]');
    if (navigator.share) share.hidden = false;
    share.onclick = () => navigator.share({ title: document.title, url }).catch(() => {});
    const copy = ov.querySelector('[data-act="copy"]');
    copy.onclick = () => {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
        () => { copy.textContent = 'Copied'; setTimeout(() => (copy.textContent = 'Copy link'), 1500); },
        () => { copy.textContent = url; });
    };
    let opener = null;
    const close = () => { ov.hidden = true; document.body.classList.remove('qr-open'); if (opener) opener.focus(); };
    ov.querySelector('.qr-close').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden) close(); });
    return {
      open(btn) {
        opener = btn;
        ov.hidden = false;
        document.body.classList.add('qr-open');
        ov.querySelector('.qr-close').focus();
      }
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('qr-btn');
    if (!btn || typeof qrcode !== 'function') return;
    let dlg = null;
    btn.addEventListener('click', () => { (dlg = dlg || build()).open(btn); });
  });
})();
