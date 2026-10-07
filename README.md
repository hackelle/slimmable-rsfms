# Project page: How Much of a Model Do We Need? Redundancy and Slimmability in Remote Sensing Foundation Models

Project website for the NeurIPS 2026 paper by Leonard Hackel, Tom Burgert and Begüm Demir (BIFOLD / TU Berlin).
Static site with no build step, served from the repository root via GitHub Pages (`.nojekyll`).

## Structure

| Path | Content |
|---|---|
| `index.html` | The page |
| `static/css/site.css` | Styles, light/dark tokens |
| `static/js/charts.js` | Dependency-free SVG line charts (hover, legend toggles, retention/log views, table, CSV) |
| `static/js/arch.js` | Interactive slimmable-ViT figure with compute estimate |
| `static/js/main.js` | Wiring of all charts, tabs, navigation |
| `static/js/data.js` | Chart data (see below) |
| `static/figures/` | Static figures rendered from the paper PDFs |
| `static/vendor/katex/` | Self-hosted KaTeX (MIT) |

## Data

`static/js/data.js` defines `window.PAPER_DATA` and `window.REBUTTAL_DATA`.

- `PAPER_DATA`: curves for Fig. 1, the post-hoc results (7 datasets) and learned-vs-post-hoc (4 datasets).
  They were read directly from the vector paths of the paper's matplotlib PDFs (values match to 3 decimals).
  Replace them with the raw results when available. The format is
  `{series: [{label, color, pts: [[rel_compute, value], ...]}], bands, refs, ylabel}`.
- `REBUTTAL_DATA`: tables R1–R9 from the OpenReview rebuttal.

Series colours and dash styles are assigned by label in `charts.js` (`STYLE`): one hue per model family,
dashed = smaller variant.

## Open TODOs

- Links: paper PDF, arXiv, OpenReview, code repository, author pages (`TODO` comments in `index.html`).
- Social preview image (`og:image`, 1200×630).

## Local preview

```
python3 -m http.server
```
