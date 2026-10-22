"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { type Chart, luminance, type PaletteEntry } from "@/lib/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Swatch({ entry, className }: { entry: PaletteEntry; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded border border-black/15 text-xs font-medium",
        className,
      )}
      style={{ background: entry.hex, color: luminance(entry.rgb) > 0.55 ? "#000" : "#fff" }}
      title={`Colour ${entry.label} (${entry.hex.toUpperCase()})`}
    >
      {entry.symbol}
    </span>
  );
}

export function ColourKey({
  chart,
  selectedCount = 0,
  activeColour = null,
  onPick,
}: {
  chart: Chart;
  /** Number of selected stitches; when non-zero, entries become buttons that apply their colour. */
  selectedCount?: number;
  /** The colour every selected stitch shares, or null if they differ. */
  activeColour?: number | null;
  onPick?: (colour: number) => void;
}) {
  const total = chart.width * chart.height;
  const picking = selectedCount > 0 && !!onPick;
  return (
    <div className="space-y-2">
      {picking && (
        <p className="text-sm text-muted-foreground">
          {selectedCount === 1
            ? "Click a colour to apply it to the selected stitch."
            : `Click a colour to apply it to all ${selectedCount} selected stitches.`}
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {chart.palette.map((p, i) => {
          const body = (
            <>
              <Swatch entry={p} className="size-8 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Colour {p.label}
                  {p.label === "A" && <span className="font-normal text-muted-foreground"> · main colour</span>}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{p.hex.toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{p.count.toLocaleString()} sts</p>
                <p className="text-xs text-muted-foreground tabular-nums">{((p.count / total) * 100).toFixed(1)}%</p>
              </div>
            </>
          );
          return (
            <li key={p.label}>
              {picking ? (
                <button
                  type="button"
                  onClick={() => onPick(i)}
                  aria-pressed={activeColour === i}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    activeColour === i && "border-blue-600 ring-1 ring-blue-600",
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FloatList({ chart }: { chart: Chart }) {
  const max = chart.settings.maxFloat;
  if (!chart.floats.length) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <p>
          No floats longer than {max} stitches. Every carried strand stays within your limit, so there&apos;s nothing to
          catch.
        </p>
      </div>
    );
  }
  const rowsAffected = new Set(chart.floats.map((f) => f.row)).size;
  const longest = Math.max(...chart.floats.map((f) => f.length));
  const shown = chart.floats.slice().sort((a, b) => a.row - b.row || a.fromStitch - b.fromStitch);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>{chart.floats.length}</strong> float{chart.floats.length === 1 ? "" : "s"} longer than {max} stitches
          across {rowsAffected} row{rowsAffected === 1 ? "" : "s"} (longest: {longest} sts). Catch the carried yarn
          behind the work partway along, or widen your limit if your yarn is sticky enough.
        </p>
      </div>
      <ul className="max-h-80 divide-y overflow-auto rounded-lg border text-sm" data-testid="float-list">
        {shown.map((f) => (
          <li key={`${f.row}-${f.fromStitch}`} className="flex items-center gap-3 px-3 py-2">
            <span className="w-16 shrink-0 font-medium tabular-nums">Row {f.row}</span>
            <span className="flex-1 text-muted-foreground tabular-nums">
              sts {f.fromStitch}–{f.toStitch}
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <Swatch entry={chart.palette[f.colour]} className="size-5" />
              {f.length} sts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RowSummaryList({ chart }: { chart: Chart }) {
  const maxPerRow = Math.max(...chart.rows.map((r) => r.colours.length));
  const limit = chart.settings.mode === "stranded" ? chart.settings.coloursPerRow : null;
  const twoPlus = chart.rows.filter((r) => r.colours.length > 2).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Up to <strong className="text-foreground">{maxPerRow}</strong> colour{maxPerRow === 1 ? "" : "s"} in any row.
        {limit
          ? ` Rows are capped at ${limit} colours; ${chart.remappedStitches.toLocaleString()} stitch${chart.remappedStitches === 1 ? " was" : "es were"} recoloured to fit.`
          : twoPlus
            ? ` ${twoPlus} row${twoPlus === 1 ? " uses" : "s use"} more than 2 colours — switch to stranded mode to cap them.`
            : ""}
      </p>
      <ul className="max-h-96 divide-y overflow-auto rounded-lg border text-sm" data-testid="row-summary">
        {chart.rows
          .slice()
          .reverse()
          .map((r) => (
            <li key={r.row} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-14 shrink-0 font-medium tabular-nums">Row {r.row}</span>
              <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                {r.colours.map((c) => (
                  <span key={c.index} className="flex items-center gap-1 tabular-nums">
                    <Swatch entry={chart.palette[c.index]} className="size-5" />
                    <span className="text-muted-foreground">×{c.count}</span>
                  </span>
                ))}
              </span>
              {r.longFloats > 0 && (
                <Badge variant="destructive" className="shrink-0">
                  {r.longFloats} long float{r.longFloats === 1 ? "" : "s"}
                </Badge>
              )}
              {r.colours.length > 2 && !limit && (
                <Badge variant="outline" className="shrink-0">
                  {r.colours.length} colours
                </Badge>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
