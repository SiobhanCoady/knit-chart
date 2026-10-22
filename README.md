# knit-chart

Turn a picture into a knitting chart, right in the browser. knit-chart is built first for **stranded colourwork** (Fair Isle-style): it keeps each row to a small number of colours and flags floats that are too long to carry. A general, unrestricted mode is there too.

Everything runs client-side on a `<canvas>`. Pictures are never uploaded anywhere.

## Features

- **Upload** by drag-and-drop or the file picker (PNG, JPG, WebP, GIF, SVG, up to 25 MB), or try the built-in sample picture. You get a preview of the picture and can **crop** it by dragging a box over it.
- **Chart settings**
  - Width in stitches (10–200). The number of rows comes from the picture's aspect ratio and the **stitch shape**, which is the ratio of stitch height to stitch width (0.8 by default). You can type in your gauge, e.g. 22 sts × 28 rows per 10 cm, to set it.
  - Number of colours (2–12), found with deterministic k-means clustering, so the same picture and settings always give the same chart.
- **Stranded colourwork mode (default)**
  - **Colours per row** limit (2 by default, 3 allowed). Each row keeps only its N most-used colours. Every other stitch in that row is recoloured to the nearest allowed colour, based on the original pixel. The app tells you how many stitches were recoloured.
  - **Float detection**: any run of one colour longer than your limit (5 stitches by default) in a row that uses more than one colour is a long float. The toggle outlines these in red on the chart. A Floats tab gives the total count and lists each one by row, stitch range, length and colour.
  - **Per-row colour summary**: for every row, which colours are carried and how many stitches of each, plus a badge on rows with long floats.
- **General mode**: every stitch takes its nearest colour with no per-row limit. This suits intarsia, duplicate stitch or cross-stitch. The per-row summary flags rows that use more than 2 colours.
- **Chart rendering** follows knitting convention:
  - Rows are numbered from the bottom (row 1 first) and stitches from the right.
  - Bold gridlines every 10 stitches and rows, anchored to the bottom-right corner.
  - Cells are drawn at the real stitch shape.
  - Each colour has a symbol, so the chart is still readable in black and white.
  - Hover over a cell to see its row, stitch and colour.
  - The zoom slider defaults to fitting the chart to the width.
- **Colour key / legend** shows each colour's letter, symbol, hex value, stitch count and share of the chart.
- **Export**
  - **PNG**: the chart plus colour key, at 2× resolution.
  - **Printable PDF**: A4 pages. The first page has the chart. The following pages have the colour key, the long-float list and the colours-per-row table.

## Running locally

Requires Node 20+.

```bash
npm install
npm run dev     # http://localhost:4317
```

Other scripts:

```bash
npm run build   # static export into out/
npm run lint
```

## Deploying

The app is a static export (`output: "export"`), hosted on GitHub Pages at https://siobhancoady.github.io/knit-chart/. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with `PAGES_BASE_PATH=/knit-chart` and publishes `out/`.

## How it works

| File | What it does |
| --- | --- |
| `src/lib/chart.ts` | Downsamples the (cropped) image to one pixel per stitch, runs k-means, applies the per-row colour limit, orders the palette by usage, finds floats and builds the per-row summaries. |
| `src/lib/render.ts` | Draws the chart (cells, symbols, gridlines, numbering, float highlights) to a canvas. The same code is used on screen and for export. |
| `src/lib/export.ts` | PNG and PDF export (PDF via [jsPDF](https://github.com/parallax/jsPDF)). |
| `src/components/` | The UI: upload zone, crop editor, chart view, and the key, floats and row panels. Built with shadcn/ui on Base UI. |

Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, shadcn/ui.
