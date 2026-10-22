"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart } from "@/lib/chart";
import { chartLayout, drawChart } from "@/lib/render";

interface ChartViewProps {
  chart: Chart;
  /** Cell width in px, or null to fit the chart to the available width. */
  zoom: number | null;
  showSymbols: boolean;
  highlightFloats: boolean;
  onCellChange?: (cell: number) => void;
}

export const MIN_CELL = 4;
export const MAX_CELL = 28;

export function fitCell(chart: Chart, containerWidth: number) {
  let cell = MAX_CELL;
  while (cell > MIN_CELL && chartLayout(chart, cell).width > containerWidth) cell -= 0.5;
  return cell;
}

export function ChartView({ chart, zoom, showSymbols, highlightFloats, onCellChange }: ChartViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hover, setHover] = useState<{ row: number; st: number; colour: number } | null>(null);
  const cell = zoom ?? (containerWidth ? fitCell(chart, containerWidth - 2) : 12);
  const layout = chartLayout(chart, cell);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawChart(canvas, chart, { cell, showSymbols, highlightFloats, scale: window.devicePixelRatio || 1 });
    onCellChange?.(cell);
  }, [chart, cell, showSymbols, highlightFloats, onCellChange]);

  const hovered = hover ? chart.palette[hover.colour] : null;

  return (
    <div className="relative">
      <div ref={wrapRef} className="max-h-[75vh] overflow-auto rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Knitting chart, ${chart.width} stitches by ${chart.height} rows in ${chart.palette.length} colours`}
          style={{ width: layout.width, height: layout.height }}
          className="block"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.floor((e.clientX - r.left - layout.left) / layout.cw);
            const y = Math.floor((e.clientY - r.top - layout.top) / layout.ch);
            if (x < 0 || y < 0 || x >= chart.width || y >= chart.height) return setHover(null);
            setHover({ row: chart.height - y, st: chart.width - x, colour: chart.cells[y * chart.width + x] });
          }}
        />
      </div>
      <div className="mt-2 flex h-5 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {hover && hovered ? (
          <>
            <span className="inline-block size-3 rounded-sm border" style={{ background: hovered.hex }} />
            <span>
              Row {hover.row}, stitch {hover.st} · colour {hovered.label}
            </span>
          </>
        ) : (
          <span>Hover the chart to see the row and stitch. Row 1 is at the bottom; stitches count from the right.</span>
        )}
      </div>
    </div>
  );
}
