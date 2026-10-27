import { type Chart, luminance, type RGB, type SeamFloat } from "./chart";

export interface RenderOptions {
  /** Cell width in CSS pixels; height follows the stitch aspect. */
  cell: number;
  showSymbols: boolean;
  highlightFloats: boolean;
  /** Device pixel ratio for crisp output. */
  scale?: number;
  /** Cell indices to outline as selected. */
  selected?: ReadonlySet<number>;
  /** Number every row and stitch, shrinking the labels to fit, instead of thinning them out when cells are small. */
  numberEvery?: boolean;
}

const MIN_LABEL = 6;

const FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

export function chartLayout(chart: Chart, cell: number) {
  const cw = cell;
  const ch = cell * chart.settings.stitchAspect;
  const label = Math.max(10, Math.min(14, cell * 0.75));
  const gutter = Math.ceil(label * 2.6);
  return {
    cw,
    ch,
    label,
    gutter,
    left: gutter,
    top: Math.ceil(label * 1.6),
    width: gutter * 2 + cw * chart.width,
    height: Math.ceil(label * 1.6) + ch * chart.height + gutter,
  };
}

export function drawChart(canvas: HTMLCanvasElement, chart: Chart, opts: RenderOptions) {
  const scale = opts.scale ?? 1;
  const L = chartLayout(chart, opts.cell);
  canvas.width = Math.ceil(L.width * scale);
  canvas.height = Math.ceil(L.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, L.width, L.height);

  const { cw, ch, left, top } = L;
  const W = chart.width;
  const H = chart.height;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = chart.palette[chart.cells[y * W + x]].hex;
      ctx.fillRect(left + x * cw, top + y * ch, cw + 0.5, ch + 0.5);
    }
  }

  if (opts.showSymbols && cw >= 7) {
    ctx.font = `${Math.round(Math.min(cw, ch) * 0.72)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = chart.palette[chart.cells[y * W + x]];
        if (!p.symbol) continue;
        ctx.fillStyle = luminance(p.rgb) > 0.55 ? "rgba(0,0,0,0.78)" : "rgba(255,255,255,0.9)";
        ctx.fillText(p.symbol, left + x * cw + cw / 2, top + y * ch + ch / 2 + 0.5);
      }
    }
  }

  // Stitches are counted from the right edge, so the bold every-10 lines are anchored there too.
  const thin = cw >= 5;
  ctx.lineWidth = 1 / scale;
  for (let x = 0; x <= W; x++) {
    const fromRight = W - x;
    const major = fromRight % 10 === 0 || x === 0;
    if (!major && !thin) continue;
    ctx.strokeStyle = major ? "rgba(20,20,20,0.85)" : "rgba(60,60,60,0.28)";
    ctx.lineWidth = major ? 1.5 : 1 / scale;
    ctx.beginPath();
    ctx.moveTo(left + x * cw, top);
    ctx.lineTo(left + x * cw, top + H * ch);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y++) {
    const fromBottom = H - y;
    const major = fromBottom % 10 === 0 || y === 0;
    if (!major && !thin) continue;
    ctx.strokeStyle = major ? "rgba(20,20,20,0.85)" : "rgba(60,60,60,0.28)";
    ctx.lineWidth = major ? 1.5 : 1 / scale;
    ctx.beginPath();
    ctx.moveTo(left, top + y * ch);
    ctx.lineTo(left + W * cw, top + y * ch);
    ctx.stroke();
  }

  if (opts.highlightFloats && chart.floats.length) {
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = Math.max(1.5, cw * 0.12);
    ctx.fillStyle = "rgba(225,29,72,0.1)";
    for (const f of chart.floats) {
      const x = left + f.gridColStart * cw;
      const y = top + f.gridRow * ch;
      const w = (f.gridColEnd - f.gridColStart + 1) * cw;
      ctx.fillRect(x, y, w, ch);
      ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, ch - ctx.lineWidth);
    }
  }

  if (opts.selected?.size) {
    const lw = Math.max(1.5, Math.min(3, cw * 0.15));
    const cells = [...opts.selected].filter((i) => i >= 0 && i < W * H);
    // Light tint first, then outlines in two passes so neighbouring cells don't paint over each other's white halo.
    ctx.fillStyle = "rgba(37,99,235,0.25)";
    for (const i of cells) ctx.fillRect(left + (i % W) * cw, top + Math.floor(i / W) * ch, cw, ch);
    for (const [width, colour] of [
      [lw * 2, "#ffffff"],
      [lw, "#2563eb"],
    ] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      for (const i of cells) ctx.strokeRect(left + (i % W) * cw, top + Math.floor(i / W) * ch, cw, ch);
    }
  }

  ctx.fillStyle = "#3f3f46";
  let rowFont = L.label;
  let colFont = L.label;
  if (opts.numberEvery) {
    rowFont = Math.max(MIN_LABEL, Math.min(L.label, ch * 0.85));
    ctx.font = `${L.label}px ${FONT}`;
    const widest = ctx.measureText(String(W)).width;
    colFont = Math.max(MIN_LABEL, Math.min(L.label, (L.label * cw * 0.9) / widest));
  }
  ctx.font = `${rowFont}px ${FONT}`;
  ctx.textBaseline = "middle";
  const rowStep = opts.numberEvery || ch >= L.label * 1.1 ? 1 : ch * 5 >= L.label * 1.1 ? 5 : 10;
  for (let y = 0; y < H; y++) {
    const row = H - y;
    if (row % rowStep !== 0 && row !== 1) continue;
    const cy = top + y * ch + ch / 2;
    ctx.textAlign = "left";
    ctx.fillText(String(row), left + W * cw + 6, cy);
    ctx.textAlign = "right";
    ctx.fillText(String(row), left - 6, cy);
  }
  const colStep = opts.numberEvery || cw >= L.label * 1.6 ? 1 : cw * 5 >= L.label * 1.6 ? 5 : 10;
  ctx.font = `${colFont}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = 0; x < W; x++) {
    const st = W - x;
    if (st % colStep !== 0 && st !== 1) continue;
    ctx.fillText(String(st), left + x * cw + cw / 2, top + H * ch + 6);
  }
  ctx.font = `${L.label}px ${FONT}`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  ctx.fillStyle = "#71717a";
  ctx.fillText(`${W} sts × ${H} rows`, left + W * cw, top - 4);
}

export interface RepeatOptions {
  across: number;
  up: number;
  /** Stitch width in CSS pixels. */
  cell: number;
  knitted: boolean;
  /** Dashed lines between repeats, plus outlines on floats that cross a join. */
  showJoins: boolean;
  seamFloats?: SeamFloat[];
  scale?: number;
}

export function repeatLayout(chart: Chart, across: number, up: number, cell: number) {
  const cw = cell;
  const ch = cell * chart.settings.stitchAspect;
  return { cw, ch, width: cw * chart.width * across, height: ch * chart.height * up };
}

const mix = (a: RGB, b: RGB, t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

/** One knit stitch: two slanted legs forming a V, extending a little above and below its cell like real fabric. */
function stitchSprite(rgb: RGB, cw: number, ch: number, scale: number) {
  const overhang = ch * 0.18;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cw * scale));
  canvas.height = Math.max(1, Math.ceil((ch + overhang * 2) * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  const midY = overhang + ch / 2;
  const grad = ctx.createLinearGradient(0, overhang, 0, overhang + ch);
  grad.addColorStop(0, mix(rgb, [255, 255, 255], 0.22));
  grad.addColorStop(0.45, `rgb(${rgb.join(",")})`);
  grad.addColorStop(1, mix(rgb, [0, 0, 0], 0.28));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cw / 2 + side * cw * 0.22, midY, cw * 0.25, (ch + overhang) * 0.52, side * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = Math.max(0.4, cw * 0.04);
    ctx.strokeStyle = mix(rgb, [0, 0, 0], 0.45);
    ctx.stroke();
  }
  return { canvas, overhang };
}

/** Tile the chart `across` × `up` times, either as knitted fabric or flat colour blocks. */
export function drawRepeatPreview(canvas: HTMLCanvasElement, chart: Chart, opts: RepeatOptions) {
  const scale = opts.scale ?? 1;
  const L = repeatLayout(chart, opts.across, opts.up, opts.cell);
  const { cw, ch } = L;
  canvas.width = Math.ceil(L.width * scale);
  canvas.height = Math.ceil(L.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const W = chart.width;
  const H = chart.height;
  const cols = W * opts.across;
  const rows = H * opts.up;
  const colourAt = (x: number, y: number) => chart.cells[(y % H) * W + (x % W)];

  if (opts.knitted) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = mix(chart.palette[colourAt(x, y)].rgb, [0, 0, 0], 0.5);
        ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
      }
    }
    const sprites = chart.palette.map((p) => stitchSprite(p.rgb, cw, ch, scale));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const s = sprites[colourAt(x, y)];
        ctx.drawImage(s.canvas, x * cw, y * ch - s.overhang, cw, ch + s.overhang * 2);
      }
    }
  } else {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = chart.palette[colourAt(x, y)].hex;
        ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
      }
    }
  }

  if (!opts.showJoins) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  for (const [colour, offset] of [
    ["rgba(255,255,255,0.9)", 0],
    ["rgba(0,0,0,0.6)", 5],
  ] as const) {
    ctx.strokeStyle = colour;
    ctx.lineDashOffset = offset;
    ctx.beginPath();
    for (let i = 1; i < opts.across; i++) {
      ctx.moveTo(i * W * cw, 0);
      ctx.lineTo(i * W * cw, L.height);
    }
    for (let i = 1; i < opts.up; i++) {
      ctx.moveTo(0, i * H * ch);
      ctx.lineTo(L.width, i * H * ch);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (!opts.seamFloats?.length || opts.across < 2) return;
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = Math.max(1.5, cw * 0.15);
  for (const f of opts.seamFloats) {
    const gridRow = H - f.row;
    for (let r = 0; r < opts.up; r++) {
      const y = (r * H + gridRow) * ch;
      for (let i = 1; i < opts.across; i++) {
        const x = (i * W - f.rightRun) * cw;
        ctx.strokeRect(x, y, f.length * cw, ch);
      }
    }
  }
}

/** Render the chart plus a colour key underneath, for PNG export. */
export function drawChartWithKey(chart: Chart, opts: RenderOptions, title?: string): HTMLCanvasElement {
  const chartCanvas = document.createElement("canvas");
  drawChart(chartCanvas, chart, { ...opts, scale: 1 });
  const scale = opts.scale ?? 2;
  const pad = 24;
  const titleFont = `600 20px ${FONT}`;
  const titleHeight = title ? 34 : 0;
  const keyRow = 26;
  const cols = Math.max(1, Math.floor((chartCanvas.width - pad) / 220));
  const keyRows = Math.ceil(chart.palette.length / cols);
  const width = Math.max(chartCanvas.width + pad * 2, 480);

  const noteFont = `12px ${FONT}`;
  const noteLineHeight = 16;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = noteFont;
  const notes = [
    "Read RS rows right → left from row 1 (bottom).",
    `Long floats (> ${chart.settings.maxFloat} sts): ${chart.floats.length}`,
  ];
  const noteLines =
    measure.measureText(notes.join(" ")).width <= width - pad * 2 ? [notes.join(" ")] : notes;

  const headerHeight = 20 + noteLines.length * noteLineHeight + 8;
  const extra = 20 + headerHeight + keyRows * keyRow + 12 + (chart.settings.mode === "stranded" ? 20 : 0);
  const height = titleHeight + chartCanvas.height + pad * 2 + extra;

  const out = document.createElement("canvas");
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  // Re-render at the export scale rather than upscaling the 1x bitmap.
  const hi = document.createElement("canvas");
  drawChart(hi, chart, { ...opts, scale });
  ctx.drawImage(hi, pad, pad + titleHeight, chartCanvas.width, chartCanvas.height);

  ctx.fillStyle = "#18181b";
  if (title) {
    ctx.font = titleFont;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    let text = title;
    while (text.length > 1 && ctx.measureText(text).width > width - pad * 2) text = text.slice(0, -2) + "…";
    ctx.fillText(text, pad, pad);
  }

  let y = pad + titleHeight + chartCanvas.height + 20;
  ctx.font = `600 14px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("Colour key", pad, y);
  ctx.font = noteFont;
  ctx.fillStyle = "#71717a";
  noteLines.forEach((line, i) => ctx.fillText(line, pad, y + 20 + i * noteLineHeight));
  y += headerHeight;
  const colW = (width - pad * 2) / cols;
  chart.palette.forEach((p, i) => {
    const cx = pad + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * keyRow;
    ctx.fillStyle = p.hex;
    ctx.fillRect(cx, cy, 20, 20);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, 19, 19);
    ctx.fillStyle = luminance(p.rgb) > 0.55 ? "#000" : "#fff";
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.symbol, cx + 10, cy + 10.5);
    ctx.textAlign = "left";
    ctx.fillStyle = "#18181b";
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`${p.label}  ${p.hex.toUpperCase()}  ·  ${p.count.toLocaleString()} sts`, cx + 28, cy + 10.5);
  });
  if (chart.settings.mode === "stranded") {
    ctx.fillStyle = "#71717a";
    ctx.textBaseline = "top";
    ctx.fillText(
      `Stranded colourwork: max ${chart.settings.coloursPerRow} colours per row.`,
      pad,
      y + keyRows * keyRow + 4,
    );
  }
  return out;
}
