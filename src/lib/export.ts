import { type Chart } from "./chart";
import { drawChart, drawChartWithKey } from "./render";

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportPng(chart: Chart, opts: { showSymbols: boolean; highlightFloats: boolean }, name: string) {
  const canvas = drawChartWithKey(chart, { cell: 16, scale: 2, numberEvery: true, ...opts });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    download(url, `${name}.png`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

export async function exportPdf(
  chart: Chart,
  opts: { showSymbols: boolean; highlightFloats: boolean },
  name: string,
) {
  const { jsPDF } = await import("jspdf");
  const canvas = document.createElement("canvas");
  drawChart(canvas, chart, { cell: 16, scale: 2, numberEvery: true, ...opts });
  const landscape = canvas.width > canvas.height;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(name, m, m + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const s = chart.settings;
  doc.text(
    `${chart.width} sts × ${chart.height} rows · ${chart.palette.length} colours · ` +
      (s.mode === "stranded" ? `stranded, max ${s.coloursPerRow} colours/row · ` : "general mode · ") +
      `${chart.floats.length} floats longer than ${s.maxFloat} sts`,
    m,
    m + 8,
  );

  const availW = pw - m * 2;
  const availH = ph - m * 2 - 14;
  const ratio = Math.min(availW / canvas.width, availH / canvas.height);
  doc.addImage(canvas, "PNG", m, m + 12, canvas.width * ratio, canvas.height * ratio, undefined, "FAST");

  doc.addPage("a4", "portrait");
  const p2w = doc.internal.pageSize.getWidth();
  const p2h = doc.internal.pageSize.getHeight();
  let y = m + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Colour key", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const p of chart.palette) {
    doc.setFillColor(p.rgb[0], p.rgb[1], p.rgb[2]);
    doc.setDrawColor(120);
    doc.rect(m, y - 3.5, 5, 5, "FD");
    // jsPDF's built-in fonts lack most chart glyphs, so the key uses the letter label in print.
    doc.text(`${p.label}   ${p.hex.toUpperCase()}   ${p.count.toLocaleString()} sts`, m + 8, y);
    y += 6.5;
  }

  const newPageIfNeeded = () => {
    if (y > p2h - m) {
      doc.addPage("a4", "portrait");
      y = m + 2;
    }
  };

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Long floats (> ${s.maxFloat} sts): ${chart.floats.length}`, m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (!chart.floats.length) {
    doc.text("None — every carried strand is within your limit.", m, y);
    y += 6;
  }
  for (const f of chart.floats) {
    newPageIfNeeded();
    doc.text(
      `Row ${f.row}: sts ${f.fromStitch}–${f.toStitch} (${f.length} sts of ${chart.palette[f.colour].label})`,
      m,
      y,
    );
    y += 5;
  }

  y += 4;
  newPageIfNeeded();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Colours per row", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const colW = (p2w - m * 2) / 2;
  let col = 0;
  for (const r of chart.rows) {
    newPageIfNeeded();
    const text =
      `Row ${r.row}: ` +
      r.colours.map((c) => `${chart.palette[c.index].label}×${c.count}`).join("  ") +
      (r.longFloats ? `   (${r.longFloats} long float${r.longFloats > 1 ? "s" : ""})` : "");
    doc.text(text, m + col * colW, y);
    col = (col + 1) % 2;
    if (col === 0) y += 4.6;
  }

  doc.save(`${name}.pdf`);
}
