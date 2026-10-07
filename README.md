# How Much of a Model Do We Need? Redundancy and Slimmability in Remote Sensing Foundation Models

Project page for the NeurIPS 2026 paper by Leonard Hackel, Tom Burgert and Begüm Demir (BIFOLD / TU Berlin).
[Paper (arXiv)](https://arxiv.org/abs/2601.22841) · [OpenReview](https://openreview.net/forum?id=0IXZABr3Tf)

A static site (no build step) served with GitHub Pages from the repository root.

- `index.html`: the page
- `static/js/`: chart library, interactive architecture figure, QR share overlay, page logic, and `data.js` with all plotted results
- `static/vendor/`: self-hosted KaTeX and qrcode-generator (both MIT)
- `static/figures/`: static figures rendered from the paper
- `scripts/`: regenerate `static/js/data.js` from the raw result CSVs:
  `RESULTS_DIR=path/to/csv_files_from_z3 python3 scripts/build_data.py scripts static/js/data.js`

Preview locally with `python3 -m http.server`.

The page was built using the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template),
which was adopted from the [Nerfies](https://nerfies.github.io) project page. The website is licensed under
[CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/).
