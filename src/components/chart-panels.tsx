"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus } from "lucide-react";
import { type Chart, luminance, MAX_PALETTE, type PaletteEntry, parseHex, type RGB, toHex } from "@/lib/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NEW_COLOUR_DEFAULT = "#3a7bd5";

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

function ColourEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onSubmit: (rgb: RGB) => void;
  onCancel: () => void;
}) {
  const [hex, setHex] = useState(initial.toUpperCase());
  const rgb = parseHex(hex);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (rgb) onSubmit(rgb);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onCancel();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={rgb ? toHex(rgb) : initial}
          onChange={(e) => setHex(e.target.value.toUpperCase())}
          aria-label="Pick a colour"
          className="h-8 w-10 cursor-pointer rounded-md border bg-background p-0.5"
        />
        <Input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Hex code"
          aria-invalid={!rgb}
          spellCheck={false}
          autoFocus
          className="h-8 w-28 font-mono uppercase"
        />
        <Button type="submit" size="sm" disabled={!rgb}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {!rgb && <p className="text-xs text-destructive">Enter a hex code like #3A7BD5.</p>}
    </form>
  );
}

export function ColourKey({
  chart,
  selectedCount = 0,
  activeColour = null,
  onPick,
  onChangeColour,
  onAddColour,
}: {
  chart: Chart;
  /** Number of selected stitches; when non-zero, entries become buttons that apply their colour. */
  selectedCount?: number;
  /** The colour every selected stitch shares, or null if they differ. */
  activeColour?: number | null;
  onPick?: (colour: number) => void;
  onChangeColour?: (index: number, rgb: RGB) => void;
  onAddColour?: (rgb: RGB) => void;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const total = chart.width * chart.height;
  const picking = selectedCount > 0 && !!onPick;
  const nextLabel = String.fromCharCode(65 + chart.palette.length);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {picking
          ? selectedCount === 1
            ? "Click a colour to apply it to the selected stitch."
            : `Click a colour to apply it to all ${selectedCount} selected stitches.`
          : onChangeColour
            ? "Use the pencil to change a yarn colour everywhere it's used, or add a new colour and click stitches to use it."
            : null}
      </p>
      <ul className="grid items-start gap-2 sm:grid-cols-2">
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
            <li
              key={p.label}
              className={cn("rounded-lg border", picking && activeColour === i && "border-blue-600 ring-1 ring-blue-600")}
            >
              <div className="flex items-center gap-1 pr-2">
                {picking ? (
                  <button
                    type="button"
                    onClick={() => onPick(i)}
                    aria-pressed={activeColour === i}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">{body}</div>
                )}
                {onChangeColour && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Change colour ${p.label}`}
                    aria-expanded={editing === i}
                    title="Change this colour"
                    onClick={() => setEditing(editing === i ? null : i)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
              {editing === i && onChangeColour && (
                <div className="border-t px-3 py-2.5">
                  <ColourEditor
                    initial={p.hex}
                    submitLabel="Save"
                    onSubmit={(rgb) => {
                      onChangeColour(i, rgb);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
        {onAddColour && (
          <li className="rounded-lg border border-dashed">
            {chart.palette.length >= MAX_PALETTE ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                The key is full at {MAX_PALETTE} colours. Change an existing colour instead.
              </p>
            ) : editing === "new" ? (
              <div className="space-y-2 px-3 py-2.5">
                <p className="text-sm font-medium">New colour {nextLabel}</p>
                <ColourEditor
                  initial={NEW_COLOUR_DEFAULT}
                  submitLabel="Add"
                  onSubmit={(rgb) => {
                    onAddColour(rgb);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="flex h-full min-h-13 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Plus className="size-4" />
                Add colour
              </button>
            )}
          </li>
        )}
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
