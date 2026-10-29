# How Much of a Model Do We Need? Redundancy and Slimmability in Remote Sensing Foundation Models

Project page for the NeurIPS 2026 paper by Leonard Hackel, Tom Burgert and Begüm Demir (BIFOLD / TU Berlin).
[Paper (arXiv)](https://arxiv.org/abs/2601.22841) · [OpenReview](https://openreview.net/forum?id=0IXZABr3Tf) · [Code](https://github.com/hackelle/slimmable-remote-sensing-foundation-models)

A static site (no build step) served with GitHub Pages from the repository root.

- `index.html`: the page
- `static/js/`: chart library, interactive architecture figure, QR share overlay, page logic, and `data.js` with all plotted results
- `static/vendor/`: self-hosted KaTeX and qrcode-generator (both MIT)
- `static/figures/`: static figures rendered from the paper
- `scripts/`: regenerate `static/js/data.js` from the paper's vector figures (the page always shows the paper's numbers):
  `python3 scripts/build_from_paper.py <overleaf>/figures/plots static/js/data.js`.
  `build_data.py` / `rr.py` rebuild it from the raw result CSVs instead, for cross-checking.

Preview locally with `python3 -m http.server`.

The page was built using the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template),
which was adopted from the [Nerfies](https://nerfies.github.io) project page. The website is licensed under
[CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/).
