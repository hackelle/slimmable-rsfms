/* Interactive version of the slimmable ViT figure (Fig. 2 of the paper). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SCALES = [0.001, 0.002, 0.0025, 0.00333, 0.004, 0.005, 0.006, 0.00667, 0.0075, 0.008, 0.01, 0.02, 0.025, 0.0333, 0.04, 0.05, 0.06, 0.0667, 0.075, 0.08, 0.1, 0.2, 0.25, 0.333, 0.4, 0.5, 0.6, 0.667, 0.75, 0.8, 1.0];
  // Typical ViT configurations of the evaluated backbones (illustrative compute estimate)
  const PRESETS = {
    s: { name: 'ViT-S/16 (e.g. SSL4EO ViT-S)', d: 384, H: 6, dk: 64, dh: 1536, L: 12, p: 16 },
    b: { name: 'ViT-B/16 (e.g. DOFA / TerraMind base)', d: 768, H: 12, dk: 64, dh: 3072, L: 12, p: 16 },
    l: { name: 'ViT-L/16 (e.g. DOFA / TerraMind large, Prithvi 300M)', d: 1024, H: 16, dk: 64, dh: 4096, L: 24, p: 16 },
    h: { name: 'ViT-H/14 (e.g. Prithvi-EO-2.0 600M)', d: 1280, H: 16, dk: 80, dh: 5120, L: 32, p: 14 }
  };
  const IMG = 224, CH = 12;

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const red = (s, n) => Math.max(1, Math.floor(s * n + 1e-9));

  function flops(c, s) {
    const N = Math.pow(IMG / c.p, 2) + 1;
    const dk = red(s, c.dk), dh = red(s, c.dh), a = c.H * dk;
    const embed = 2 * (N - 1) * (CH * c.p * c.p) * c.d;
    const attn = 2 * N * c.d * 3 * a + 2 * N * N * a * 2 + 2 * N * a * c.d;
    const ffn = 2 * N * c.d * dh * 2;
    return { total: embed + c.L * (attn + ffn), dk, dh };
  }
  function params(c, s) {
    const dk = red(s, c.dk), dh = red(s, c.dh);
    return 4 * c.d * c.H * dk + 2 * c.d * dh;
  }

  const TIPS = {
    patches: ['Image patches', 'A multispectral image (here a Sentinel-2 patch from BigEarthNet) is split into non-overlapping p × p patches. Slimming never touches this step.'],
    proj: ['Linear projection + position embedding', 'Each patch is embedded into d dimensions. The embedding is <b>not</b> slimmed in our protocol, so models with heavy embeddings (e.g. Panopticon, &gt;66% of parameters) keep part of their compute fixed.'],
    tokens: ['Tokens', 'N patch tokens plus a [CLS] token, each of width d. The token width d stays the same at every slimming factor s.'],
    encoder: ['Transformer encoder (L blocks)', 'Every one of the L blocks is slimmed uniformly with the same factor s. No block is removed, no weight is retrained.'],
    head: ['Task head', 'Frozen-feature evaluation: k-NN (k = 5) or a linear probe for classification, a light multi-scale head for segmentation and change detection. The rebuttal adds full fine-tuning.'],
    norm: ['LayerNorm', 'Slimming changes only the FFN hidden width and the per-head width inside MHSA. The embedding dimension d is unchanged, so every LayerNorm runs on the same d features at every width and needs no recalibration or switchable parameters (unlike BatchNorm in learned slimmable CNNs).'],
    mhsa: ['Slimmable multi-head self-attention', 'All H heads are kept. Each head keeps only its first d<sub>k</sub>′ = ⌊s·d<sub>k</sub>⌋ dimensions (at least 1) of Q, K and V, and the matching input columns of the output projection.', 'I_h = [h·d_k, h·d_k + d_k′)\nQ = x W_Q[I,:]ᵀ + b_Q[I]\nx_attn = softmax(QKᵀ/√d_k′) V\ny = x_attn W_O[:,I]ᵀ + b_O'],
    ffn: ['Slimmable feed-forward network', 'The hidden layer keeps its first d<sub>h</sub>′ = ⌊s·d<sub>h</sub>⌋ units. The input and output stay d-dimensional, so the residual stream is untouched.', 'h = Act(x W₁[:d_h′,:]ᵀ + b₁[:d_h′])\ny = h W₂[:,:d_h′]ᵀ + b₂'],
    add: ['Residual connection', 'Residual additions are unchanged. Because the residual stream keeps width d, a slimmed block still adds a full-width update.'],
    s: ['Width factor s', 'One scalar controls every block. We evaluate 31 values from s = 0.001 to 1.0. Drag the slider below to see what is kept.'],
    order: ['Which dimensions are kept?', 'We keep the <i>first</i> dimensions. Appendix B shows that keeping the last or a random subset (20 draws, 2σ) gives comparable results, so the effect is not driven by an implicit ordering of dimensions.']
  };

  function build(host) {
    const svg = el('svg', { viewBox: '0 0 1000 620', role: 'img', 'aria-label': 'Slimmable Vision Transformer: architecture and slimmable encoder block' });
    host.appendChild(svg);
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ink-2)' }, mk);
    const cp = el('clipPath', { id: 'patchClip' }, defs);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) el('rect', { x: 20 + c * 20 + 1, y: 35 + r * 20 + 1, width: 18, height: 18, rx: 1.5 }, cp);

    const hov = (key, parent) => { const g = el('g', { class: 'hov', tabindex: 0, 'data-tip': key }, parent || svg); return g; };
    const arrow = (x1, y1, x2, y2, extra) => el('path', Object.assign({ class: 'flow', d: `M${x1},${y1} L${x2},${y2}`, 'marker-end': 'url(#arr)' }, extra || {}), svg);

    // ---- row 1: ViT pipeline
    let g = hov('patches');
    el('rect', { class: 'hit', x: 16, y: 31, width: 128, height: 128, rx: 6, fill: 'transparent', stroke: 'transparent' }, g);
    el('image', { href: 'static/images/sentinel2_patch.jpg', x: 20, y: 35, width: 120, height: 120, 'clip-path': 'url(#patchClip)', preserveAspectRatio: 'xMidYMid slice' }, g);
    el('text', { x: 80, y: 178, 'text-anchor': 'middle', class: 't-small' }, g, 'Image patches');
    arrow(146, 95, 186, 95);
    g = hov('proj');
    el('rect', { class: 'box hit', x: 190, y: 60, width: 112, height: 70, rx: 6 }, g);
    el('text', { x: 246, y: 91, 'text-anchor': 'middle', class: 't-small' }, g, 'Linear proj.');
    el('text', { x: 246, y: 108, 'text-anchor': 'middle', class: 't-small' }, g, '+ pos. emb.');
    arrow(302, 95, 344, 95);
    g = hov('tokens');
    el('rect', { class: 'hit', x: 346, y: 40, width: 58, height: 104, fill: 'transparent', stroke: 'transparent', rx: 4 }, g);
    [['[CLS]', 44, 'var(--line)'], ['z₁', 70, 'var(--accent-soft)'], ['z_N', 118, 'var(--accent-soft)']].forEach(([t, y, f]) => {
      el('rect', { x: 352, y, width: 46, height: 20, fill: f, stroke: 'var(--ink-3)', 'stroke-width': 1 }, g);
      const tx = el('text', { x: 375, y: y + 14, 'text-anchor': 'middle', class: 't-tiny' }, g, t === 'z_N' ? null : t);
      if (t === 'z_N') { el('tspan', {}, tx, 'z'); el('tspan', { 'baseline-shift': 'sub', 'font-size': '8' }, tx, 'N'); }
    });
    el('text', { x: 375, y: 108, 'text-anchor': 'middle', class: 't-small' }, g, '⋮');
    arrow(404, 95, 442, 95);
    g = hov('encoder');
    el('rect', { class: 'hit', x: 446, y: 40, width: 240, height: 112, rx: 8, fill: 'var(--enc-soft)', stroke: 'var(--c-green)', 'stroke-width': 1.6 }, g);
    el('text', { x: 566, y: 70, 'text-anchor': 'middle', class: 't-small t-bold' }, g, 'Transformer Encoder (L×)');
    el('rect', { x: 476, y: 98, width: 82, height: 30, rx: 5, fill: 'var(--mhsa-soft)', stroke: 'var(--mhsa)', 'stroke-width': 2 }, g);
    el('text', { x: 517, y: 118, 'text-anchor': 'middle', class: 't-small' }, g, 'MHSA');
    el('rect', { x: 574, y: 98, width: 82, height: 30, rx: 5, fill: 'var(--ffn-soft)', stroke: 'var(--ffn)', 'stroke-width': 2 }, g);
    el('text', { x: 615, y: 118, 'text-anchor': 'middle', class: 't-small' }, g, 'FFN');
    arrow(686, 95, 736, 95);
    g = hov('head');
    el('rect', { class: 'box hit', x: 740, y: 70, width: 92, height: 50, rx: 6 }, g);
    el('text', { x: 786, y: 100, 'text-anchor': 'middle', class: 't-small' }, g, 'Head');
    arrow(832, 95, 872, 95);
    el('text', { x: 878, y: 99, class: 't-small' }, svg, 'Class / mask');

    // zoom lines + frame
    el('path', { d: 'M446,152 L20,222 M686,152 L980,222', stroke: 'var(--ink-3)', 'stroke-dasharray': '5 4', 'stroke-width': 1.2, fill: 'none' }, svg);
    el('rect', { x: 20, y: 222, width: 960, height: 382, rx: 14, fill: 'none', stroke: 'var(--ink-3)', 'stroke-dasharray': '6 5', 'stroke-width': 1.3 }, svg);
    el('text', { x: 36, y: 246, class: 't-small', 'font-style': 'italic', fill: 'var(--ink-2)' }, svg, 'Slimmable encoder block (×L, all with the same s)');

    const Y = 400;
    const zin = el('text', { x: 30, y: Y + 5, class: 't-math' }, svg); el('tspan', {}, zin, 'z'); el('tspan', { 'baseline-shift': 'sub', 'font-size': '10' }, zin, 'ℓ−1');
    arrow(62, Y, 88, Y);
    const norm = (x, key) => { const n = hov('norm'); el('rect', { class: 'box hit', x, y: Y - 40, width: 40, height: 80, rx: 5 }, n); el('text', { x: x + 20, y: Y + 4, 'text-anchor': 'middle', class: 't-tiny', transform: `rotate(-90 ${x + 20} ${Y})` }, n, 'LayerNorm'); };
    norm(90);
    arrow(130, Y, 166, Y);

    // MHSA
    g = hov('mhsa');
    el('rect', { class: 'hit', x: 170, y: 290, width: 250, height: 210, rx: 10, fill: 'var(--mhsa-soft)', stroke: 'var(--mhsa)', 'stroke-width': 2.2 }, g);
    el('text', { x: 295, y: 314, 'text-anchor': 'middle', class: 't-small t-bold' }, g, 'MHSA');
    const heads = [];
    [['1', 334], ['2', 368], ['H', 444]].forEach(([lab, y]) => {
      el('text', { x: 190, y: y + 14, 'text-anchor': 'middle', class: 't-tiny' }, g, lab);
      el('rect', { class: 'drop', x: 204, y, width: 196, height: 20, rx: 3 }, g);
      heads.push(el('rect', { class: 'kept-a', x: 204, y, width: 49, height: 20, rx: 3 }, g));
    });
    el('text', { x: 300, y: 420, 'text-anchor': 'middle', class: 't-small' }, g, '⋮');
    const dkLab = el('text', { x: 295, y: 488, 'text-anchor': 'middle', class: 't-tiny' }, g, '');

    arrow(420, Y, 440, Y);
    const add = (cx) => { const a = hov('add'); el('circle', { class: 'hit', cx, cy: Y, r: 13, fill: 'var(--surface)', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }, a); el('text', { x: cx, y: Y + 5, 'text-anchor': 'middle', class: 't-small t-bold' }, a, '+'); };
    add(455);
    arrow(468, Y, 488, Y);
    norm(490);
    arrow(530, Y, 566, Y);

    // FFN
    g = hov('ffn');
    el('rect', { class: 'hit', x: 570, y: 290, width: 250, height: 210, rx: 10, fill: 'var(--ffn-soft)', stroke: 'var(--ffn)', 'stroke-width': 2.2 }, g);
    el('text', { x: 695, y: 314, 'text-anchor': 'middle', class: 't-small t-bold' }, g, 'FFN');
    const ins = [360, 400, 440].map((y) => [612, y]), outs = [360, 400, 440].map((y) => [778, y]);
    const hid = Array.from({ length: 8 }, (_, i) => [695, 334 + i * 18.3]);
    const edges = [];
    hid.forEach((hp, i) => {
      const grp = [];
      ins.concat(outs).forEach((q) => grp.push(el('line', { class: 'edge', x1: q[0], y1: q[1], x2: hp[0], y2: hp[1], 'stroke-width': 1 }, g)));
      edges.push(grp);
    });
    ins.concat(outs).forEach((q) => el('circle', { class: 'neuron', cx: q[0], cy: q[1], r: 7, fill: 'var(--surface)', stroke: 'var(--ink-2)' }, g));
    const hidN = hid.map((q) => el('circle', { class: 'neuron', cx: q[0], cy: q[1], r: 6.5 }, g));
    const dhLab = el('text', { x: 695, y: 494, 'text-anchor': 'middle', class: 't-tiny' }, g, '');

    arrow(820, Y, 845, Y);
    add(860);
    arrow(873, Y, 905, Y);
    const zo = el('text', { x: 910, y: Y + 5, class: 't-math' }, svg); el('tspan', {}, zo, 'z'); el('tspan', { 'baseline-shift': 'sub', 'font-size': '10' }, zo, 'ℓ');

    // residuals
    g = hov('add');
    el('path', { class: 'flow', d: `M75,${Y} L75,268 L455,268 L455,${Y - 15}`, 'marker-end': 'url(#arr)' }, g);
    el('path', { class: 'flow', d: `M479,${Y} L479,272 L860,272 L860,${Y - 15}`, 'marker-end': 'url(#arr)' }, g);
    el('circle', { cx: 75, cy: Y, r: 3, fill: 'var(--ink-2)' }, g);
    el('circle', { cx: 479, cy: Y, r: 3, fill: 'var(--ink-2)' }, g);
    el('path', { class: 'hit', d: `M75,${Y} L75,268 L455,268 M479,272 L860,272`, stroke: 'transparent', 'stroke-width': 10, fill: 'none' }, g);

    // s pill
    g = hov('s');
    el('rect', { class: 'hit', x: 410, y: 548, width: 180, height: 34, rx: 17, fill: 'color-mix(in srgb, var(--c-yellow) 22%, var(--surface))', stroke: 'var(--c-yellow)', 'stroke-width': 1.6 }, g);
    const sLab = el('text', { x: 500, y: 570, 'text-anchor': 'middle', class: 't-small t-bold' }, g, 'width factor s');
    el('path', { d: 'M410,565 L295,565 L295,506', stroke: 'var(--mhsa)', 'stroke-width': 1.8, fill: 'none', 'marker-end': 'url(#arr)' }, svg);
    el('path', { d: 'M590,565 L695,565 L695,506', stroke: 'var(--ffn)', 'stroke-width': 1.8, fill: 'none', 'marker-end': 'url(#arr)' }, svg);

    // legend + ordering hint
    g = hov('order');
    el('rect', { class: 'hit', x: 846, y: 520, width: 122, height: 70, rx: 8, fill: 'transparent', stroke: 'var(--line)' }, g);
    el('rect', { x: 858, y: 532, width: 14, height: 12, rx: 2, fill: 'var(--mhsa)' }, g);
    el('circle', { cx: 884, cy: 538, r: 6, fill: 'var(--ffn)' }, g);
    el('text', { x: 896, y: 542, class: 't-tiny' }, g, 'kept');
    el('rect', { class: 'drop', x: 858, y: 554, width: 14, height: 12, rx: 2 }, g);
    el('circle', { cx: 884, cy: 560, r: 6, fill: 'var(--surface)', stroke: 'var(--ink-3)', 'stroke-dasharray': '2 2' }, g);
    el('text', { x: 896, y: 564, class: 't-tiny' }, g, 'dropped');
    el('text', { x: 907, y: 583, 'text-anchor': 'middle', class: 't-tiny', 'font-style': 'italic' }, g, 'why the first dims?');

    return { svg, heads, hidN, edges, dkLab, dhLab, sLab };
  }

  function init() {
    const host = document.getElementById('arch-svg');
    if (!host) return;
    const F = build(host);
    const slider = document.getElementById('s-slider');
    const preset = document.getElementById('arch-preset');
    const out = (id) => document.getElementById(id);
    slider.max = SCALES.length - 1;
    slider.value = SCALES.indexOf(0.25);

    function update() {
      const s = SCALES[+slider.value], c = PRESETS[preset.value];
      const f = flops(c, s), full = flops(c, 1);
      const rel = f.total / full.total;
      const pr = params(c, s) / params(c, 1);
      F.heads.forEach((r) => r.setAttribute('width', Math.max(2, 196 * f.dk / c.dk)));
      const nKeep = Math.max(1, Math.round(8 * f.dh / c.dh));
      F.hidN.forEach((n, i) => {
        const k = i < nKeep;
        n.setAttribute('fill', k ? 'var(--ffn)' : 'var(--surface)');
        n.setAttribute('stroke', k ? 'var(--ffn)' : 'var(--ink-3)');
        n.setAttribute('stroke-dasharray', k ? '' : '2 2');
        F.edges[i].forEach((e) => { e.setAttribute('stroke', k ? 'var(--ink-2)' : 'var(--ink-3)'); e.setAttribute('opacity', k ? 0.9 : 0.22); e.setAttribute('stroke-dasharray', k ? '' : '3 3'); });
      });
      F.dkLab.textContent = `per head: d_k′ = ${f.dk} of ${c.dk}`;
      F.dhLab.textContent = `hidden: d_h′ = ${f.dh} of ${c.dh}`;
      F.sLab.textContent = `width factor s = ${s}`;
      out('s-val').textContent = 's = ' + s;
      out('ro-dk').textContent = `${f.dk} / ${c.dk}`;
      out('ro-dh').textContent = `${f.dh} / ${c.dh}`;
      out('ro-heads').textContent = `${c.H} / ${c.H}`;
      out('ro-d').textContent = `${c.d} (unchanged)`;
      out('ro-par').textContent = (pr * 100).toPrecision(pr < 0.01 ? 2 : 3) + '%';
      const rp = rel * 100;
      out('ro-flops').textContent = (rp < 10 ? rp.toFixed(1) : rp.toFixed(0)) + '%';
      out('ro-meter').style.width = Math.max(0.6, rp) + '%';
      out('ro-gflops').textContent = (f.total / 1e9).toFixed(1) + ' / ' + (full.total / 1e9).toFixed(1) + ' GFLOPs';
    }
    slider.addEventListener('input', update);
    preset.addEventListener('change', update);
    update();

    // tooltips
    const tip = window.ChartTooltip.get();
    const showTip = (g, x, y) => {
      const t = TIPS[g.dataset.tip];
      if (!t) return;
      tip.innerHTML = '';
      const ti = document.createElement('div'); ti.className = 'tt-title'; ti.textContent = t[0]; tip.appendChild(ti);
      const p = document.createElement('p'); p.innerHTML = t[1]; tip.appendChild(p); // static, author-written strings
      if (t[2]) { const e = document.createElement('code'); e.className = 'eq'; e.textContent = t[2]; tip.appendChild(e); }
      tip.classList.add('show');
      window.ChartTooltip.place(tip, x, y);
    };
    F.svg.querySelectorAll('.hov').forEach((g) => {
      g.addEventListener('pointermove', (e) => showTip(g, e.clientX, e.clientY));
      g.addEventListener('pointerleave', () => tip.classList.remove('show'));
      g.addEventListener('focus', () => { const r = g.getBoundingClientRect(); showTip(g, r.right, r.top); });
      g.addEventListener('blur', () => tip.classList.remove('show'));
    });
  }
  window.addEventListener('DOMContentLoaded', init);
})();
