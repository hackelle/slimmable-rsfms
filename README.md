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

Generated from the raw result CSVs:

```
RESULTS_DIR=path/to/csv_files_from_z3 python3 scripts/build_data.py scripts static/js/data.js
```

`scripts/rr.py` re-implements `read_results()` from the analysis notebook. `PAPER_DATA` holds Fig. 1
(10%-wide compute bins, as in the paper), the post-hoc results (7 datasets) and learned-vs-post-hoc
(4 datasets, epoch-100 checkpoints). `REBUTTAL_DATA` holds the rebuttal analyses with x = relative compute;
geo-shift, class-imbalance and class-wise AP values are the notebook outputs (their features are not in the CSV export).

Series colours and dash styles are assigned by label in `charts.js` (`STYLE`): one hue per model family,
dashed = smaller variant.

## Open TODOs

- Links: paper PDF, arXiv, OpenReview, code repository, author pages (`TODO` comments in `index.html`).
- Social preview image (`og:image`, 1200×630).

## Local preview

```
python3 -m http.server
```
