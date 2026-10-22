export type RGB = [number, number, number];

export type ChartMode = "stranded" | "general";

export interface CropRect {
  /** Fractions of the source image, 0–1. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartSettings {
  stitches: number;
  /** Stitch height ÷ stitch width. Knit stitches are wider than tall, so this is usually < 1. */
  stitchAspect: number;
  colours: number;
  mode: ChartMode;
  coloursPerRow: number;
  maxFloat: number;
  crop: CropRect | null;
}

export interface PaletteEntry {
  rgb: RGB;
  hex: string;
  symbol: string;
  label: string;
  count: number;
}

export interface Float {
  /** Row number in knitting convention: 1 = bottom row. */
  row: number;
  /** Stitch numbers in knitting convention: 1 = rightmost stitch. */
  fromStitch: number;
  toStitch: number;
  length: number;
  /** Palette index of the colour being worked; the other colours in the row float behind it. */
  colour: number;
  /** Zero-based grid coordinates, top-left origin, for drawing. */
  gridRow: number;
  gridColStart: number;
  gridColEnd: number;
}

export interface RowSummary {
  row: number;
  colours: { index: number; count: number }[];
  longFloats: number;
}

export interface Chart {
  width: number;
  height: number;
  /** Palette index per cell, row-major, top-left origin. */
  cells: Uint8Array;
  palette: PaletteEntry[];
  rows: RowSummary[];
  floats: Float[];
  remappedStitches: number;
  settings: ChartSettings;
}

export const SYMBOLS = ["", "×", "●", "○", "▲", "■", "◆", "+", "/", "★", "▼", "♥"];

export const DEFAULT_SETTINGS: ChartSettings = {
  stitches: 60,
  stitchAspect: 0.8,
  colours: 4,
  mode: "stranded",
  coloursPerRow: 2,
  maxFloat: 5,
  crop: null,
};

export const MAX_ROWS = 400;

export function chartRows(
  sourceW: number,
  sourceH: number,
  settings: Pick<ChartSettings, "stitches" | "stitchAspect" | "crop">,
): number {
  const crop = settings.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const w = sourceW * crop.w;
  const h = sourceH * crop.h;
  const rows = Math.round((settings.stitches * (h / w)) / settings.stitchAspect);
  return Math.max(1, Math.min(MAX_ROWS, rows));
}

/** Downsample the (cropped) image to one pixel per stitch. */
export function sampleImage(
  image: CanvasImageSource & { width: number; height: number },
  settings: ChartSettings,
): { pixels: RGB[]; width: number; height: number } {
  const width = settings.stitches;
  const height = chartRows(image.width, image.height, settings);
  const crop = settings.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = crop.x * image.width;
  const sy = crop.y * image.height;
  const sw = crop.w * image.width;
  const sh = crop.h * image.height;

  // Step down in halves so the final draw averages source pixels instead of point-sampling them.
  let src: CanvasImageSource = image;
  let srcX = sx;
  let srcY = sy;
  let srcW = sw;
  let srcH = sh;
  while (srcW / 2 > width && srcH / 2 > height) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(srcW / 2));
    c.height = Math.max(1, Math.round(srcH / 2));
    const cx = c.getContext("2d")!;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(src, srcX, srcY, srcW, srcH, 0, 0, c.width, c.height);
    src = c;
    srcX = 0;
    srcY = 0;
    srcW = c.width;
    srcH = c.height;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, srcX, srcY, srcW, srcH, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const pixels: RGB[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    // Composite transparency onto white, which is how most transparent artwork is meant to read.
    pixels[i] = [
      Math.round(data[i * 4] * a + 255 * (1 - a)),
      Math.round(data[i * 4 + 1] * a + 255 * (1 - a)),
      Math.round(data[i * 4 + 2] * a + 255 * (1 - a)),
    ];
  }
  return { pixels, width, height };
}

/** Perceptually weighted RGB distance ("redmean"), cheap and good enough for yarn palettes. */
export function colourDistance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic k-means with k-means++ seeding, so the same image and settings always give the same chart. */
export function kmeans(pixels: RGB[], k: number, iterations = 16): RGB[] {
  const rand = mulberry32(1337);
  const n = pixels.length;
  const centres: RGB[] = [pixels[Math.floor(rand() * n)]];
  const dist = new Float64Array(n).fill(Infinity);

  while (centres.length < k) {
    const last = centres[centres.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = colourDistance(pixels[i], last);
      if (d < dist[i]) dist[i] = d;
      total += dist[i];
    }
    if (total === 0) break;
    let r = rand() * total;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      r -= dist[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centres.push([...pixels[pick]] as RGB);
  }

  const assign = new Uint8Array(n);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const best = nearest(pixels[i], centres);
      if (best !== assign[i]) {
        assign[i] = best;
        changed = true;
      }
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const s = sums[assign[i]];
      s[0] += pixels[i][0];
      s[1] += pixels[i][1];
      s[2] += pixels[i][2];
      s[3]++;
    }
    for (let c = 0; c < centres.length; c++) {
      const s = sums[c];
      if (s[3] > 0) centres[c] = [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])];
    }
    if (!changed && iter > 0) break;
  }
  return centres;
}

export function nearest(p: RGB, palette: RGB[], allowed?: number[]): number {
  let best = 0;
  let bestD = Infinity;
  const indices = allowed ?? palette.map((_, i) => i);
  for (const i of indices) {
    const d = colourDistance(p, palette[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function toHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function luminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function buildChart(
  image: CanvasImageSource & { width: number; height: number },
  settings: ChartSettings,
): Chart {
  const { pixels, width, height } = sampleImage(image, settings);
  const rawPalette = kmeans(pixels, settings.colours);
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) cells[i] = nearest(pixels[i], rawPalette);

  let remappedStitches = 0;
  if (settings.mode === "stranded") {
    for (let y = 0; y < height; y++) {
      const counts = new Map<number, number>();
      for (let x = 0; x < width; x++) {
        const c = cells[y * width + x];
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      if (counts.size <= settings.coloursPerRow) continue;
      const allowed = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, settings.coloursPerRow)
        .map(([c]) => c);
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!allowed.includes(cells[i])) {
          cells[i] = nearest(pixels[i], rawPalette, allowed);
          remappedStitches++;
        }
      }
    }
  }

  // Reorder the palette by usage so colour A is always the main colour, and drop colours that ended up unused.
  const usage = rawPalette.map(() => 0);
  for (const c of cells) usage[c]++;
  const order = rawPalette
    .map((_, i) => i)
    .filter((i) => usage[i] > 0)
    .sort((a, b) => usage[b] - usage[a]);
  const remap = new Uint8Array(rawPalette.length);
  order.forEach((old, i) => (remap[old] = i));
  for (let i = 0; i < cells.length; i++) cells[i] = remap[cells[i]];

  const palette: PaletteEntry[] = order.map((old, i) => ({
    rgb: rawPalette[old],
    hex: toHex(rawPalette[old]),
    symbol: SYMBOLS[i % SYMBOLS.length],
    label: String.fromCharCode(65 + i),
    count: usage[old],
  }));

  return summariseChart(width, height, cells, palette, settings, remappedStitches);
}

/**
 * Change stitches to one palette colour. The palette keeps its order, so labels and symbols stay put.
 * Returns the same chart when nothing changes.
 */
export function recolourCells(chart: Chart, indices: Iterable<number>, colour: number): { chart: Chart; changed: number } {
  let cells: Uint8Array | null = null;
  let changed = 0;
  for (const i of indices) {
    if (chart.cells[i] === colour) continue;
    cells ??= chart.cells.slice();
    cells[i] = colour;
    changed++;
  }
  if (!cells) return { chart, changed: 0 };
  return {
    chart: summariseChart(chart.width, chart.height, cells, chart.palette, chart.settings, chart.remappedStitches),
    changed,
  };
}

function summariseChart(
  width: number,
  height: number,
  cells: Uint8Array,
  basePalette: PaletteEntry[],
  settings: ChartSettings,
  remappedStitches: number,
): Chart {
  const usage = basePalette.map(() => 0);
  for (const c of cells) usage[c]++;
  const palette = basePalette.map((p, i) => ({ ...p, count: usage[i] }));

  const floats = findFloats(cells, width, height, settings.maxFloat);
  const floatsPerGridRow = new Map<number, number>();
  for (const f of floats) floatsPerGridRow.set(f.gridRow, (floatsPerGridRow.get(f.gridRow) ?? 0) + 1);

  const rows: RowSummary[] = [];
  for (let y = height - 1; y >= 0; y--) {
    const counts = new Map<number, number>();
    for (let x = 0; x < width; x++) {
      const c = cells[y * width + x];
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    rows.push({
      row: height - y,
      colours: [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([index, count]) => ({ index, count })),
      longFloats: floatsPerGridRow.get(y) ?? 0,
    });
  }

  return { width, height, cells, palette, rows, floats, remappedStitches, settings };
}

/**
 * A float is the strand of an unused colour carried across the back while another colour is worked.
 * It gets too long when one colour runs for more than `maxFloat` stitches in a row that also uses
 * other colours. Single-colour rows carry nothing, so they never have floats.
 */
export function findFloats(cells: Uint8Array, width: number, height: number, maxFloat: number): Float[] {
  const floats: Float[] = [];
  for (let y = 0; y < height; y++) {
    const base = y * width;
    let multi = false;
    for (let x = 1; x < width; x++) {
      if (cells[base + x] !== cells[base]) {
        multi = true;
        break;
      }
    }
    if (!multi) continue;
    let start = 0;
    for (let x = 1; x <= width; x++) {
      if (x === width || cells[base + x] !== cells[base + start]) {
        const length = x - start;
        if (length > maxFloat) {
          const end = x - 1;
          floats.push({
            row: height - y,
            fromStitch: width - end,
            toStitch: width - start,
            length,
            colour: cells[base + start],
            gridRow: y,
            gridColStart: start,
            gridColEnd: end,
          });
        }
        start = x;
      }
    }
  }
  return floats;
}
