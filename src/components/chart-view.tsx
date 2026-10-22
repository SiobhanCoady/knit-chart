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
  /** Indices into `chart.cells` of the selected stitches. */
  selected?: ReadonlySet<number>;
  onSelect?: (indices: ReadonlySet<number>) => void;
}

export const MIN_CELL = 4;
export const MAX_CELL = 28;

const NONE: ReadonlySet<number> = new Set();

export function fitCell(chart: Chart, containerWidth: number) {
  let cell = MAX_CELL;
  while (cell > MIN_CELL && chartLayout(chart, cell).width > containerWidth) cell -= 0.5;
  return cell;
}

interface Drag {
  anchor: { x: number; y: number };
  last: { x: number; y: number };
  base: ReadonlySet<number>;
  additive: boolean;
  moved: boolean;
}

export function ChartView({
  chart,
  zoom,
  showSymbols,
  highlightFloats,
  onCellChange,
  selected = NONE,
  onSelect,
}: ChartViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
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
    drawChart(canvas, chart, { cell, showSymbols, highlightFloats, selected, scale: window.devicePixelRatio || 1 });
    onCellChange?.(cell);
  }, [chart, cell, showSymbols, highlightFloats, selected, onCellChange]);

  const hovered = hover ? chart.palette[hover.colour] : null;

  const gridPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left - layout.left) / layout.cw),
      y: Math.floor((e.clientY - r.top - layout.top) / layout.ch),
    };
  };
  const inGrid = ({ x, y }: { x: number; y: number }) => x >= 0 && y >= 0 && x < chart.width && y < chart.height;
  const clamp = ({ x, y }: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(chart.width - 1, x)),
    y: Math.max(0, Math.min(chart.height - 1, y)),
  });

  const selectRect = (drag: Drag) => {
    const next = new Set(drag.additive ? drag.base : NONE);
    const [x0, x1] = [Math.min(drag.anchor.x, drag.last.x), Math.max(drag.anchor.x, drag.last.x)];
    const [y0, y1] = [Math.min(drag.anchor.y, drag.last.y), Math.max(drag.anchor.y, drag.last.y)];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) next.add(y * chart.width + x);
    onSelect?.(next);
  };

  const summary = selectionSummary(chart, selected);

  return (
    <div className="relative">
      <div ref={wrapRef} className="max-h-[75vh] overflow-auto rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Knitting chart, ${chart.width} stitches by ${chart.height} rows in ${chart.palette.length} colours`}
          style={{ width: layout.width, height: layout.height }}
          className={onSelect ? "block cursor-pointer touch-none select-none" : "block"}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => {
            if (!onSelect || e.button !== 0) return;
            const at = gridPos(e);
            const additive = e.shiftKey || e.metaKey || e.ctrlKey;
            if (!inGrid(at)) {
              if (!additive) onSelect(NONE);
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = { anchor: at, last: at, base: selected, additive, moved: false };
          }}
          onPointerMove={(e) => {
            const raw = gridPos(e);
            const drag = dragRef.current;
            if (drag) {
              const at = clamp(raw);
              if (at.x !== drag.last.x || at.y !== drag.last.y) {
                drag.last = at;
                drag.moved = true;
                selectRect(drag);
              }
            }
            if (!inGrid(raw)) return setHover(null);
            setHover({ row: chart.height - raw.y, st: chart.width - raw.x, colour: chart.cells[raw.y * chart.width + raw.x] });
          }}
          onPointerUp={() => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag || drag.moved || !onSelect) return;
            const index = drag.anchor.y * chart.width + drag.anchor.x;
            if (drag.additive) {
              const next = new Set(selected);
              if (next.has(index)) next.delete(index);
              else next.add(index);
              onSelect(next);
            } else {
              onSelect(selected.size === 1 && selected.has(index) ? NONE : new Set([index]));
            }
          }}
          onPointerCancel={() => (dragRef.current = null)}
        />
      </div>
      <div className="mt-2 flex min-h-5 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {summary ? (
          <>
            <span className="flex">
              {summary.colours.map((c) => (
                <span
                  key={c}
                  className="-ml-1 inline-block size-3 rounded-sm border first:ml-0"
                  style={{ background: chart.palette[c].hex }}
                />
              ))}
            </span>
            <span className="text-foreground">
              {summary.text} Pick a colour in the key to change {selected.size === 1 ? "it" : "them all"}, or press Esc
              to deselect.
            </span>
          </>
        ) : hover && hovered ? (
          <>
            <span className="inline-block size-3 rounded-sm border" style={{ background: hovered.hex }} />
            <span>
              Row {hover.row}, stitch {hover.st} · colour {hovered.label}
            </span>
          </>
        ) : (
          <span>
            Click a stitch to recolour it. Drag to select a block, or Shift-click to add stitches. Row 1 is at the
            bottom; stitches count from the right.
          </span>
        )}
      </div>
    </div>
  );
}

function selectionSummary(chart: Chart, selected: ReadonlySet<number>) {
  if (!selected.size) return null;
  const colours = [...new Set([...selected].map((i) => chart.cells[i]))].sort((a, b) => a - b);
  const labels = colours.map((c) => chart.palette[c].label).join(", ");
  if (selected.size === 1) {
    const [i] = selected;
    return {
      colours,
      text: `Row ${chart.height - Math.floor(i / chart.width)}, stitch ${chart.width - (i % chart.width)} selected (colour ${labels}).`,
    };
  }
  return {
    colours,
    text: `${selected.size} stitches selected (colour${colours.length === 1 ? "" : "s"} ${labels}).`,
  };
}
