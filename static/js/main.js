(function () {
  'use strict';
  const P = window.PAPER_DATA, R = window.REBUTTAL_DATA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---------- theme ---------- */
  const root = document.documentElement;
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (e) { /* storage unavailable */ }
  function rerenderCharts() { (window.__charts || []).forEach((c) => c.render()); }
  window.addEventListener('DOMContentLoaded', () => {
    const btn = $('#theme-btn');
    if (btn) btn.onclick = () => {
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* ignore */ }
      rerenderCharts();
    };
  });

  const charts = (window.__charts = []);
  const chart = (sel, opts) => { const c = new LineChart($(sel), opts); charts.push(c); return c; };
  const ser = (label, xs, ys, style) => ({ label, pts: xs.map((x, i) => [x, ys[i]]), style });

  function minRetention(series) {
    const r = series.map((s) => { const p = s.pts.slice().sort((a, b) => a[0] - b[0]); return p[0][1] / p[p.length - 1][1]; });
    return [Math.min(...r), Math.max(...r)];
  }
  const pc = (v) => Math.round(v * 100) + '%';

  /* ---------- Fig. 1 ---------- */
  function fig1() {
    const a = chart('#chart-fig1a', { relative: false, ypct: true, ydomain: [0, 1.06], yclip: [0, 1.06], file: 'fig1a_retention', note: 'Shaded: spread across models / datasets, as in the paper.', aria: 'Relative retention vs compute, RS FMs and CV baselines' });
    a.set({ series: P.fig1a.series, bands: P.fig1a.bands, ylabel: 'Rel. retention rate' });
    const b = chart('#chart-fig1b', { file: 'fig1b_eurosat', note: 'Shaded: spread across models / seeds, as in the paper.', aria: 'Accuracy on m-eurosat vs compute' });
    b.set({ series: P.fig1b.series, bands: P.fig1b.bands, refs: P.fig1b.refs.map((r) => Object.assign({ text: 'CV MAE @ 100% compute' }, r)), ylabel: 'Accuracy on m-eurosat' });
  }

  /* ---------- post-hoc explorer ---------- */
  const DS_NOTES = {
    'm-eurosat': 'All eight models stay above 80% retention down to their smallest budget. Degradation only starts below ~20% compute.',
    'm-bigearthnet': 'Seven of eight models keep 78–87%. DOFA (large) drops to 67%, partly because it peaks at an intermediate width, so its full-scale reference is below its own maximum. This harder multi-label task needs roughly 2–10% compute.',
    'm-brick-kiln': 'The binary task tolerates the smallest budgets; several models end at or above their full-scale accuracy.',
    'm-so2sat': '17 local climate zones with geographically disjoint train/test cities (Cultural-10 split) make this the hardest classification setting; DOFA (large) is the clear outlier.',
    'm-cashew-plant': 'Dense prediction is even more robust: all models keep 98–101% IoU, curves are nearly flat across the entire compute range.',
    'm-SA-crop-type': 'The harder 10-class crop-type segmentation still retains 78–94% IoU at the smallest budget.',
    'oscd': 'Change detection keeps 94–109% IoU. Both DOFA models and Prithvi-EO-2.0 (300M) exceed their full-scale IoU at small widths.'
  };
  const DS_LABEL = { 'm-eurosat': 'm-eurosat', 'm-bigearthnet': 'm-bigearthnet', 'm-brick-kiln': 'm-brick-kiln', 'm-so2sat': 'm-so2sat', 'm-cashew-plant': 'm-cashew-plant', 'm-SA-crop-type': 'm-SA-crop-type', 'oscd': 'OSCD' };

  function explorer(prefix, data, notes, file) {
    const state = { ds: Object.keys(data)[0], relative: false, xlog: true };
    const c = chart('#' + prefix + '-chart', { xlog: true, file });
    const desc = $('#' + prefix + '-desc'), stat = $('#' + prefix + '-stat');
    const draw = () => {
      const d = data[state.ds];
      c.o.file = file + '_' + state.ds;
      c.set({ series: d.series, ylabel: d.ylabel + ' on ' + DS_LABEL[state.ds] }, { relative: state.relative, xlog: state.xlog });
      if (desc) desc.textContent = (d.desc ? d.desc + '. ' : '') + (notes[state.ds] || '');
      if (stat) { const [lo, hi] = minRetention(d.series); stat.textContent = pc(lo) + '–' + pc(hi); }
    };
    makeSeg($('#' + prefix + '-ds'), Object.keys(data).map((k) => [k, DS_LABEL[k]]), state.ds, (v) => { state.ds = v; draw(); });
    makeSeg($('#' + prefix + '-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { state.relative = v; c.update({ relative: v }); });
    makeSeg($('#' + prefix + '-x'), [[true, 'Log'], [false, 'Linear']], true, (v) => { state.xlog = v; c.update({ xlog: v }); });
    draw();
  }

  /* ---------- rebuttal panels ---------- */
  const fam = (m) => (window.SeriesStyle(m.replace('(base)', '(large)').replace('(300M)', '(600M)')).color);
  function rebuttal() {
    // fine-tuning
    {
      const st = { ds: 'm-eurosat', rel: false };
      const c = chart('#rb-ft-chart', { xlog: true, xticks: [0.01, 0.1, 1], file: 'rebuttal_finetune' });
      const draw = () => {
        const d = R.finetune[st.ds], s = [];
        Object.keys(d).forEach((m) => {
          s.push(ser(m + ' · linear probe', R.finetune.x, d[m].linear, { color: fam(m), dash: true }));
          s.push(ser(m + ' · full fine-tune', R.finetune.x, d[m].finetune, { color: fam(m), dash: false }));
        });
        c.set({ series: s, ylabel: (st.ds === 'm-eurosat' ? 'Accuracy' : 'mAP') + ' on ' + st.ds }, { relative: st.rel });
      };
      makeSeg($('#rb-ft-ds'), [['m-eurosat', 'm-eurosat'], ['m-bigearthnet', 'm-bigearthnet']], st.ds, (v) => { st.ds = v; draw(); });
      makeSeg($('#rb-ft-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { st.rel = v; c.update({ relative: v }); });
      draw();
    }
    // newer FMs
    {
      const st = { ds: 'm-eurosat', proto: 'knn', rel: false };
      const c = chart('#rb-new-chart', { xlog: true, xticks: [0.001, 0.01, 0.1, 0.5, 1], file: 'rebuttal_new_fms' });
      const draw = () => {
        const d = R.newfms[st.proto][st.ds];
        const s = Object.keys(d).map((m) => ser(m, R.newfms.x, d[m], m === 'Panopticon' || m === 'Copernicus-FM' ? window.SeriesStyle(m) : { color: fam(m), dash: true }));
        c.set({ series: s, ylabel: (st.ds === 'm-eurosat' ? 'Accuracy' : 'mAP') + ' on ' + st.ds + (st.proto === 'knn' ? ' (k-NN)' : ' (linear)') }, { relative: st.rel });
      };
      makeSeg($('#rb-new-ds'), [['m-eurosat', 'm-eurosat'], ['m-bigearthnet', 'm-bigearthnet']], st.ds, (v) => { st.ds = v; draw(); });
      makeSeg($('#rb-new-proto'), [['knn', 'k-NN'], ['linear', 'Linear probe']], st.proto, (v) => { st.proto = v; draw(); });
      makeSeg($('#rb-new-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { st.rel = v; c.update({ relative: v }); });
      draw();
    }
    // geographic shift
    {
      const st = { rel: false };
      const c = chart('#rb-geo-chart', { xlog: true, xticks: [0.01, 0.1, 1], file: 'rebuttal_geo_shift' });
      const draw = () => {
        const s = [];
        Object.keys(R.geo).filter((k) => k !== 'x').forEach((m) => {
          s.push(ser(m + ' · random split', R.geo.x, R.geo[m].random, { color: fam(m), dash: true }));
          s.push(ser(m + ' · Cultural-10 (disjoint cities)', R.geo.x, R.geo[m]['Cultural-10'], { color: fam(m), dash: false }));
        });
        c.set({ series: s, ylabel: 'Accuracy on m-so2sat' }, { relative: st.rel });
      };
      makeSeg($('#rb-geo-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { st.rel = v; c.update({ relative: v }); });
      draw();
    }
    // class imbalance
    {
      const st = { m: 'TerraMind-1.0 (base)', rel: false };
      const ramp = ['#a7dccb', '#5fbfa2', '#228c72', '#0b5546'];
      const c = chart('#rb-imb-chart', { xlog: true, xticks: [0.01, 0.1, 1], file: 'rebuttal_imbalance' });
      const draw = () => {
        const d = R.imbalance[st.m];
        const s = ['0.01', '0.1', '0.2', '1.0'].map((k, i) => ser('imbalance ratio ' + k + (k === '1.0' ? ' (balanced)' : ''), R.imbalance.x, d[k], { color: ramp[i], dash: false }));
        c.set({ series: s, ylabel: 'Accuracy on m-eurosat · ' + st.m }, { relative: st.rel });
      };
      makeSeg($('#rb-imb-m'), Object.keys(R.imbalance).filter((k) => k !== 'x').map((k) => [k, k]), st.m, (v) => { st.m = v; draw(); });
      makeSeg($('#rb-imb-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { st.rel = v; c.update({ relative: v }); });
      draw();
    }
    // class-wise AP
    {
      const st = { rel: false };
      const c = chart('#rb-cls-chart', { xlog: true, xticks: [0.01, 0.1, 1], file: 'rebuttal_classwise_ap' });
      const draw = () => {
        const s = [];
        Object.keys(R.classwise).filter((k) => k !== 'x').forEach((m) => {
          const e = R.classwise[m];
          s.push(ser(m + ' · easiest: ' + e.easiest[0], R.classwise.x, e.easiest[1], { color: fam(m), dash: false }));
          s.push(ser(m + ' · hardest: ' + e.hardest[0], R.classwise.x, e.hardest[1], { color: fam(m), dash: true }));
        });
        c.set({ series: s, ylabel: 'Class AP on m-bigearthnet' }, { relative: st.rel });
      };
      makeSeg($('#rb-cls-view'), [[false, 'Absolute'], [true, 'Retention']], false, (v) => { st.rel = v; c.update({ relative: v }); });
      draw();
    }
    // tabs
    const tabs = $$('[data-rb-tab]');
    makeSeg($('#rb-tabs'), tabs.map((t) => [t.dataset.rbTab, t.dataset.title]), tabs[0].dataset.rbTab, (v) => {
      tabs.forEach((t) => (t.hidden = t.dataset.rbTab !== v));
      rerenderCharts();
    });
  }

  /* ---------- static figure tabs ---------- */
  function figTabs() {
    $$('[data-figtabs]').forEach((host) => {
      const panels = $$('.fig-panel', host.parentElement);
      makeSeg(host, panels.map((p) => [p.dataset.id, p.dataset.title]), panels[0].dataset.id, (v) => panels.forEach((p) => (p.hidden = p.dataset.id !== v)));
      panels.forEach((p, i) => (p.hidden = i !== 0));
    });
  }

  /* ---------- nav, reveal, bibtex ---------- */
  function chrome() {
    const links = $$('.nav .links a');
    const secs = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach((s) => io.observe(s));
    const rv = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }), { threshold: 0.08 });
    $$('.reveal').forEach((n) => rv.observe(n));
    const cb = $('#copy-bib');
    if (cb) cb.onclick = () => {
      navigator.clipboard.writeText($('#bibtex').textContent).then(() => { cb.textContent = 'Copied'; setTimeout(() => (cb.textContent = 'Copy'), 1500); });
    };
    $$('.btn.pending').forEach((b) => b.addEventListener('click', (e) => e.preventDefault()));
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
  }

  /* ---------- hero canvas: a field of "dimensions" that switch off and on ---------- */
  function hero() {
    const cv = $('#hero-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cells = [], W, H, S = 22;
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      for (let y = 0; y < H / S + 1; y++) for (let x = 0; x < W / S + 1; x++) cells.push({ x, y, a: Math.random(), t: Math.random() });
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      cells.forEach((c) => {
        const k = 0.5 + 0.5 * Math.sin(c.t * 6.283);
        const fade = Math.max(0, 1 - Math.abs(c.y * S - H * 0.15) / (H * 1.1));
        ctx.fillStyle = `rgba(143, 227, 204, ${(0.03 + 0.11 * k * c.a) * fade})`;
        ctx.fillRect(c.x * S + 2, c.y * S + 2, S - 4, S - 4);
      });
    };
    resize(); draw();
    addEventListener('resize', () => { resize(); draw(); });
    if (reduce) return;
    let last = 0;
    const loop = (t) => {
      if (t - last > 60) { cells.forEach((c) => (c.t += 0.004 + c.a * 0.004)); draw(); last = t; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  window.addEventListener('DOMContentLoaded', () => {
    chrome();
    hero();
    fig1();
    explorer('ph', P.posthoc, DS_NOTES, 'posthoc');
    explorer('nv', P.native, {
      'm-eurosat': 'Slimmable MoCo matches or beats regular MoCo at most budgets; regular MAE beats slimmable MAE almost everywhere.',
      'm-bigearthnet': 'Both MoCo variants reach similar full-scale mAP, but slimmable MoCo gets close to its peak at far lower compute. Slimmable MAE also degrades at large widths.'
    }, 'learned_vs_posthoc');
    rebuttal();
    figTabs();
  });
})();
