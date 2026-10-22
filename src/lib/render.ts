import { type Chart, luminance } from "./chart";

export interface RenderOptions {
  /** Cell width in CSS pixels; height follows the stitch aspect. */
  cell: number;
  showSymbols: boolean;
  highlightFloats: boolean;
  /** Device pixel ratio for crisp output. */
  scale?: number;
  /** Cell indices to outline as selected. */
  selected?: ReadonlySet<number>;
}

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
  ctx.font = `${L.label}px ${FONT}`;
  ctx.textBaseline = "middle";
  const rowStep = ch >= L.label * 1.1 ? 1 : ch * 5 >= L.label * 1.1 ? 5 : 10;
  for (let y = 0; y < H; y++) {
    const row = H - y;
    if (row % rowStep !== 0 && row !== 1) continue;
    const cy = top + y * ch + ch / 2;
    ctx.textAlign = "left";
    ctx.fillText(String(row), left + W * cw + 6, cy);
    ctx.textAlign = "right";
    ctx.fillText(String(row), left - 6, cy);
  }
  const colStep = cw >= L.label * 1.6 ? 1 : cw * 5 >= L.label * 1.6 ? 5 : 10;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = 0; x < W; x++) {
    const st = W - x;
    if (st % colStep !== 0 && st !== 1) continue;
    ctx.fillText(String(st), left + x * cw + cw / 2, top + H * ch + 6);
  }
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  ctx.fillStyle = "#71717a";
  ctx.fillText(`${W} sts × ${H} rows`, left + W * cw, top - 4);
}

/** Render the chart plus a colour key underneath, for PNG export. */
export function drawChartWithKey(chart: Chart, opts: RenderOptions): HTMLCanvasElement {
  const chartCanvas = document.createElement("canvas");
  drawChart(chartCanvas, chart, { ...opts, scale: 1 });
  const scale = opts.scale ?? 2;
  const pad = 24;
  const keyRow = 26;
  const cols = Math.max(1, Math.floor((chartCanvas.width - pad) / 220));
  const keyRows = Math.ceil(chart.palette.length / cols);
  const extra = 40 + keyRows * keyRow + 12 + (chart.settings.mode === "stranded" ? 20 : 0);
  const width = Math.max(chartCanvas.width + pad * 2, 480);
  const height = chartCanvas.height + pad * 2 + extra;

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
  ctx.drawImage(hi, pad, pad, chartCanvas.width, chartCanvas.height);

  let y = pad + chartCanvas.height + 20;
  ctx.fillStyle = "#18181b";
  ctx.font = `600 14px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("Colour key", pad, y);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#71717a";
  ctx.textAlign = "right";
  ctx.fillText(
    `Read RS rows right → left from row 1 (bottom). Long floats (> ${chart.settings.maxFloat} sts): ${chart.floats.length}`,
    width - pad,
    y + 2,
  );
  ctx.textAlign = "left";
  y += 24;
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
