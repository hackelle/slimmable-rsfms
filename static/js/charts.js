/* Lightweight, dependency-free SVG line charts with hover crosshair, legend toggles,
   absolute/retention and linear/log views, data table and CSV export. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- series styling (one hue per model family; dashed = smaller variant) ---------- */
  const STYLE = {
    'DOFA (base)': ['blue', 1], 'DOFA (large)': ['blue', 0],
    'Prithvi-EO-2.0 (300M)': ['aqua', 1], 'Prithvi-EO-2.0 (600M)': ['aqua', 0],
    'SSL4EO ViT-S (Dino)': ['violet', 1], 'SSL4EO ViT-S (MoCo)': ['violet', 0],
    'TerraMind-1.0 (base)': ['orange', 1], 'TerraMind-1.0 (large)': ['orange', 0],
    'Panopticon': ['magenta', 0], 'Copernicus-FM': ['yellow', 0],
    'RS FMs @ 4 RS datasets (avg.)': ['green', 0], 'RS FMs @ m-eurosat': ['green', 0],
    'CV MAE @ ImageNet-10': ['orange', 0], 'CV DINOv2 @ ImageNet-10': ['yellow', 0],
    'CV MAE @ ImageNet-100': ['red', 0], 'CV MAE @ m-eurosat': ['violet', 0],
    'MAE: regular training': ['orange', 1], 'MAE: slimmable training': ['orange', 0],
    'MoCo: regular training': ['violet', 1], 'MoCo: slimmable training': ['violet', 0]
  };
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function styleFor(label, fallback) {
    const s = STYLE[label];
    if (s) return { color: 'var(--c-' + s[0] + ')', dash: !!s[1] };
    return fallback || { color: 'var(--c-blue)', dash: false };
  }
  window.SeriesStyle = styleFor;

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function linTicks(a, b, n) {
    const st = niceStep(b - a, n), out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  }
  const pct = (x) => {
    const v = x * 100;
    if (v === 0) return '0%';
    if (v < 1) return (+v.toPrecision(2)) + '%';
    if (v < 10) return (+v.toFixed(1)) + '%';
    return Math.round(v) + '%';
  };
  const f3 = (v) => v.toFixed(3);

  /* shared tooltip */
  let TT;
  function tooltip() {
    if (!TT) { TT = h('div', 'tooltip', document.body); TT.setAttribute('role', 'status'); }
    return TT;
  }
  function placeTip(tt, cx, cy) {
    const r = tt.getBoundingClientRect(), pad = 14;
    let x = cx + pad, y = cy + pad;
    if (x + r.width > innerWidth - 8) x = cx - r.width - pad;
    if (y + r.height > innerHeight - 8) y = cy - r.height - pad;
    tt.style.left = Math.max(8, x) + 'px';
    tt.style.top = Math.max(8, y) + 'px';
  }
  window.ChartTooltip = { get: tooltip, place: placeTip };

  /* ---------- LineChart ---------- */
  class LineChart {
    constructor(host, opts) {
      this.host = host;
      this.o = Object.assign({ height: 330, xlog: false, relative: false, xlabel: 'Relative compute requirement', yfmt: f3 }, opts || {});
      this.hidden = new Set();
      this.legend = h('div', 'legend', host);
      this.box = h('div', 'chart', host);
      const foot = h('div', 'chart-foot', host);
      this.note = h('div', 'muted small', foot);
      const btns = h('div', '', foot);
      this.tblBtn = h('button', 'linkbtn', btns, 'Show data table');
      h('span', 'muted small', btns, '  ·  ');
      this.csvBtn = h('button', 'linkbtn', btns, 'Download CSV');
      this.tblWrap = h('div', 'table-wrap', host);
      this.tblWrap.hidden = true;
      this.tblBtn.onclick = () => {
        this.tblWrap.hidden = !this.tblWrap.hidden;
        this.tblBtn.textContent = this.tblWrap.hidden ? 'Show data table' : 'Hide data table';
        if (!this.tblWrap.hidden) this.renderTable();
      };
      this.csvBtn.onclick = () => this.csv();
      new ResizeObserver(() => this.render()).observe(this.box);
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.render());
    }
    set(data, opts) {
      this.d = data;
      if (opts) Object.assign(this.o, opts);
      this.hidden.clear();
      this.renderLegend();
      this.render();
      if (!this.tblWrap.hidden) this.renderTable();
    }
    update(opts) { Object.assign(this.o, opts); this.render(); if (!this.tblWrap.hidden) this.renderTable(); }

    series() {
      return this.d.series.map((s) => {
        const st = s.style || styleFor(s.label);
        let pts = s.pts.slice().sort((a, b) => a[0] - b[0]);
        let base = 1;
        if (this.o.relative) { base = pts[pts.length - 1][1]; pts = pts.map((p) => [p[0], p[1] / base]); }
        return { label: s.label, sub: s.sub, pts, color: st.color, dash: st.dash, raw: s, base };
      });
    }
    renderLegend() {
      this.legend.textContent = '';
      this.series().forEach((s) => {
        const b = h('button', '', this.legend);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'true');
        const sv = el('svg', { viewBox: '0 0 22 10' }, b);
        el('line', { x1: 1, y1: 5, x2: 21, y2: 5, stroke: s.color, 'stroke-width': 2.5, 'stroke-dasharray': s.dash ? '4 3' : '', 'stroke-linecap': 'round' }, sv);
        el('circle', { cx: 11, cy: 5, r: 2.6, fill: s.color }, sv);
        h('span', '', b, s.label);
        b.onclick = (ev) => {
          if (ev.altKey || ev.metaKey) {
            const all = this.series().map((x) => x.label);
            this.hidden = new Set(all.filter((x) => x !== s.label));
          } else if (this.hidden.has(s.label)) this.hidden.delete(s.label);
          else this.hidden.add(s.label);
          [...this.legend.children].forEach((c, i) => c.setAttribute('aria-pressed', String(!this.hidden.has(this.series()[i].label))));
          this.render();
        };
        b.onmouseenter = () => this.focus(s.label);
        b.onmouseleave = () => this.focus(null);
      });
    }
    focus(label) {
      if (!this.g) return;
      this.g.querySelectorAll('.series').forEach((n) => n.classList.toggle('dim', !!label && n.dataset.label !== label));
    }
    render() {
      if (!this.d) return;
      const W = this.box.clientWidth || 600;
      if (W < 50) return;
      const H = this.o.height;
      const all = this.series(), vis = all.filter((s) => !this.hidden.has(s.label));
      const endLabels = vis.length <= 4 && W > 620 && this.o.endLabels !== false;
      const m = { t: 12, r: endLabels ? 150 : 18, b: 46, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      this.box.textContent = '';
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': (this.o.aria || 'Line chart') }, this.box);

      // domains
      const xs = [], ys = [];
      vis.forEach((s) => s.pts.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }));
      (this.d.refs || []).forEach((r) => { if (!this.o.relative) ys.push(r.y); });
      if (this.o.bands !== false && !this.o.relative) (this.d.bands || []).forEach((b) => b.pts.forEach((p) => ys.push(Math.min(Math.max(p[1], (this.o.yclip || [-1e9])[0]), (this.o.yclip || [0, 1e9])[1]))));
      if (!xs.length) { xs.push(0.01, 1); ys.push(0, 1); }
      let x0, x1, X;
      if (this.o.xlog) {
        const mn = Math.max(Math.min(...xs.filter((v) => v > 0)), 1e-4);
        x0 = Math.log10(mn) - 0.08; x1 = 0.02;
        X = (v) => m.l + ((Math.log10(Math.max(v, 1e-6)) - x0) / (x1 - x0)) * iw;
      } else {
        x0 = this.o.xmin != null ? this.o.xmin : 0; x1 = 1;
        const pad = 0.02;
        X = (v) => m.l + ((v - x0 + pad) / (x1 - x0 + 2 * pad)) * iw;
      }
      let y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (this.o.ydomain) { [y0, y1] = this.o.ydomain; }
      else { const sp = (y1 - y0) || 0.1; y0 -= sp * 0.08; y1 += sp * 0.08; }
      const yt = linTicks(y0, y1, Math.max(3, Math.round(ih / 55)));
      const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;

      const clipId = 'c' + Math.random().toString(36).slice(2);
      const defs = el('defs', {}, svg);
      el('rect', { x: m.l, y: m.t, width: iw, height: ih }, el('clipPath', { id: clipId }, defs));

      // grid + axes
      const ax = el('g', { class: 'axis' }, svg);
      yt.forEach((v) => {
        el('line', { class: 'gridline', x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v) }, ax);
        const t = el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, ax);
        t.textContent = this.o.relative || this.o.ypct ? Math.round(v * 100) + '%' : (+v.toFixed(3)).toString();
      });
      let xt;
      if (this.o.xlog) {
        xt = [];
        for (let e = Math.ceil(x0); e <= 0; e++) xt.push(Math.pow(10, e));
        if (this.o.xticks) xt = this.o.xticks;
      } else xt = this.o.xticks || [0, .2, .4, .6, .8, 1];
      xt.forEach((v) => {
        el('line', { class: 'gridline', x1: X(v), x2: X(v), y1: m.t, y2: m.t + ih }, ax);
        const t = el('text', { x: X(v), y: m.t + ih + 18, 'text-anchor': 'middle' }, ax);
        t.textContent = pct(v);
      });
      el('line', { class: 'baseline', x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih }, ax);
      const xtl = el('text', { class: 'axis-title', x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
      xtl.textContent = this.o.xlabel + (this.o.xlog ? ' (log scale)' : '');
      const ytl = el('text', { class: 'axis-title', transform: `translate(14 ${m.t + ih / 2}) rotate(-90)`, 'text-anchor': 'middle' }, svg);
      ytl.textContent = this.o.relative ? 'Relative retention (vs. 100% compute)' : (this.d.ylabel || '');

      const g = el('g', { 'clip-path': `url(#${clipId})` }, svg);
      this.g = g;
      // bands (only in absolute view of pre-aggregated figures)
      if (this.o.bands !== false && !this.o.relative) (this.d.bands || []).forEach((b) => {
        const s = vis.find((v) => v.raw.color === b.color);
        if (!s) return;
        el('polygon', { class: 'band', fill: s.color, points: b.pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') }, g);
      });
      // reference lines
      if (!this.o.relative) (this.d.refs || []).forEach((r) => {
        const st = styleFor(r.label);
        el('line', { class: 'ref', stroke: st.color, x1: m.l, x2: m.l + iw, y1: Y(r.y), y2: Y(r.y) }, svg);
        const t = el('text', { class: 'ref-label', x: m.l + iw - 6, y: Y(r.y) + 15, 'text-anchor': 'end' }, svg);
        t.textContent = (r.text || (r.label + ' @ 100% compute')) + ' = ' + r.y.toFixed(3);
      });
      // 100% retention guide
      if (this.o.relative && 1 >= y0 && 1 <= y1) el('line', { class: 'ref', stroke: 'var(--ink-3)', x1: m.l, x2: m.l + iw, y1: Y(1), y2: Y(1) }, svg);

      vis.forEach((s) => {
        const sg = el('g', { class: 'series' }, g);
        sg.dataset.label = s.label;
        el('path', { class: 'ln', stroke: s.color, 'stroke-dasharray': s.dash ? '6 4' : '', d: 'M' + s.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('L') }, sg);
        if (s.pts.length <= 40) s.pts.forEach((p) => el('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2.6, fill: s.color }, sg));
      });

      // end labels
      if (endLabels) {
        const lab = vis.map((s) => ({ s, y: Y(s.pts[s.pts.length - 1][1]) })).sort((a, b) => a.y - b.y);
        for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 14) lab[i].y = lab[i - 1].y + 14;
        lab.forEach((l) => {
          el('line', { x1: m.l + iw + 3, x2: m.l + iw + 14, y1: l.y, y2: l.y, stroke: l.s.color, 'stroke-width': 2, 'stroke-dasharray': l.s.dash ? '3 2' : '' }, svg);
          const t = el('text', { class: 'direct', x: m.l + iw + 18, y: l.y + 4 }, svg);
          t.textContent = l.s.label.length > 22 ? l.s.label.slice(0, 21) + '…' : l.s.label;
        });
      }

      // hover layer
      const hair = el('line', { class: 'hair', y1: m.t, y2: m.t + ih, visibility: 'hidden' }, svg);
      const dots = el('g', {}, svg);
      const ov = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Chart data; use arrow keys to move' }, svg);
      const allX = [...new Set(vis.flatMap((s) => s.pts.map((p) => p[0])))].sort((a, b) => a - b);
      let keyIdx = allX.length - 1;
      const tt = tooltip();
      const show = (sx, cx, cy) => {
        if (!allX.length) return;
        let best = allX[0], bd = 1e9;
        allX.forEach((x) => { const d = Math.abs(X(x) - sx); if (d < bd) { bd = d; best = x; } });
        keyIdx = allX.indexOf(best);
        hair.setAttribute('x1', X(best)); hair.setAttribute('x2', X(best)); hair.setAttribute('visibility', 'visible');
        dots.textContent = '';
        const rows = [];
        vis.forEach((s) => {
          let p = null, pd = 1e9;
          s.pts.forEach((q) => { const d = Math.abs(X(q[0]) - X(best)); if (d < pd) { pd = d; p = q; } });
          if (!p || pd > 28) return;
          el('circle', { class: 'hl-dot', cx: X(p[0]), cy: Y(p[1]), r: 5, fill: s.color }, dots);
          rows.push({ s, p });
        });
        rows.sort((a, b) => b.p[1] - a.p[1]);
        tt.textContent = '';
        h('div', 'tt-h', tt, this.o.xtip ? this.o.xtip(best) : (this.o.xname || 'Rel. compute') + ' ≈ ' + pct(best));
        rows.forEach(({ s, p }) => {
          const r = h('div', 'row', tt);
          const k = h('i', 'key' + (s.dash ? ' dash' : ''), r); k.style.borderTopColor = s.color;
          h('b', '', r, this.o.relative ? (p[1] * 100).toFixed(1) + '%' : this.o.yfmt(p[1]));
          const extra = Math.abs(X(p[0]) - X(best)) > 1 ? ' (at ' + pct(p[0]) + ')' : '';
          h('span', '', r, s.label + extra);
        });
        if (!rows.length) h('p', '', tt, 'No measurement near this point.');
        tt.classList.add('show');
        placeTip(tt, cx, cy);
      };
      const hide = () => { hair.setAttribute('visibility', 'hidden'); dots.textContent = ''; tt.classList.remove('show'); };
      ov.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width);
        show(sx, e.clientX, e.clientY);
      });
      ov.addEventListener('pointerleave', hide);
      ov.addEventListener('blur', hide);
      ov.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        keyIdx = Math.max(0, Math.min(allX.length - 1, keyIdx + (e.key === 'ArrowRight' ? 1 : -1)));
        const r = svg.getBoundingClientRect(), sx = X(allX[keyIdx]);
        show(sx, r.left + sx * (r.width / W), r.top + 30);
      });
      this.note.textContent = this.o.note || 'Click a legend entry to hide it, Alt/⌘-click to isolate it.';
    }
    rows() {
      const out = [];
      this.series().forEach((s) => s.pts.forEach((p) => out.push([s.label, p[0], p[1]])));
      return out;
    }
    renderTable() {
      this.tblWrap.textContent = '';
      const t = h('table', 'dtable', this.tblWrap), hr = h('tr', '', h('thead', '', t));
      ['Series', 'Rel. compute', this.o.relative ? 'Retention' : (this.d.ylabel || 'Value')].forEach((c) => h('th', '', hr, c));
      const tb = h('tbody', '', t);
      this.rows().forEach((r) => {
        const tr = h('tr', '', tb);
        h('td', '', tr, r[0]); h('td', '', tr, pct(r[1])); h('td', '', tr, this.o.relative ? (r[2] * 100).toFixed(1) + '%' : r[2].toFixed(3));
      });
    }
    csv() {
      const lines = ['series,rel_compute,' + (this.o.relative ? 'retention' : 'value')];
      this.rows().forEach((r) => lines.push('"' + r[0].replace(/"/g, '""') + '",' + r[1] + ',' + r[2].toFixed(5)));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
      a.download = (this.o.file || 'slimmability') + (this.o.relative ? '_retention' : '') + '.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  }
  window.LineChart = LineChart;

  /* ---------- segmented controls ---------- */
  window.makeSeg = function (host, items, value, onChange) {
    host.textContent = '';
    host.classList.add('seg');
    host.setAttribute('role', 'group');
    const btns = items.map(([v, label]) => {
      const b = h('button', '', host, label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(v === value));
      b.onclick = () => { btns.forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onChange(v); };
      return b;
    });
  };
})();
