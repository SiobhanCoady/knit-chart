"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { type Chart, findSeamFloats } from "@/lib/chart";
import { drawRepeatPreview, repeatLayout } from "@/lib/render";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Keeps the preview to a few hundred thousand stitches so redrawing after an edit stays quick. */
const MAX_STITCHES_ACROSS = 600;
const MAX_ROWS_UP = 800;
const MAX_CELL = 24;
const MIN_CELL = 2;
/** Below this the V shapes turn to mush, so the preview falls back to flat colour. */
const MIN_KNIT_CELL = 5;

const sliderValue = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

export function RepeatPreview({ chart }: { chart: Chart }) {
  const [enabled, setEnabled] = useState(false);
  const [across, setAcross] = useState(4);
  const [up, setUp] = useState(2);
  const [style, setStyle] = useState<"knitted" | "flat">("knitted");
  const [showJoins, setShowJoins] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maxAcross = Math.max(1, Math.min(12, Math.floor(MAX_STITCHES_ACROSS / chart.width)));
  const maxUp = Math.max(1, Math.min(6, Math.floor(MAX_ROWS_UP / chart.height)));
  const a = Math.min(across, maxAcross);
  const u = Math.min(up, maxUp);
  const cell = containerWidth
    ? Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((containerWidth / (chart.width * a)) * 2) / 2))
    : 8;
  const knitted = style === "knitted" && cell >= MIN_KNIT_CELL;
  const layout = repeatLayout(chart, a, u, cell);
  const seamFloats = useMemo(() => findSeamFloats(chart), [chart]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!enabled || !el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    drawRepeatPreview(canvas, chart, {
      across: a,
      up: u,
      cell,
      knitted,
      showJoins,
      seamFloats,
      scale: window.devicePixelRatio || 1,
    });
  }, [enabled, chart, a, u, cell, knitted, showJoins, seamFloats]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repeat preview</CardTitle>
        <CardDescription>
          {enabled
            ? `Your ${chart.width} × ${chart.height} chart worked ${a} time${a === 1 ? "" : "s"} across and ${u} time${u === 1 ? "" : "s"} up (${chart.width * a} sts × ${chart.height * u} rows).`
            : "Is this chart one repeat of a motif, say for a yoke or a border? Turn this on to see it tiled the way it will be knitted."}
        </CardDescription>
        <CardAction>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Repeating pattern" />
            Repeating pattern
          </label>
        </CardAction>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <Label>Repeats across</Label>
                <span className="text-sm font-medium tabular-nums">{a}</span>
              </div>
              <Slider
                value={[a]}
                min={1}
                max={maxAcross}
                step={1}
                onValueChange={(v) => setAcross(sliderValue(v))}
                aria-label="Repeats across"
              />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <Label>Repeats up</Label>
                <span className="text-sm font-medium tabular-nums">{u}</span>
              </div>
              <Slider
                value={[u]}
                min={1}
                max={maxUp}
                step={1}
                onValueChange={(v) => setUp(sliderValue(v))}
                aria-label="Repeats up"
              />
            </div>
            <div className="space-y-2">
              <Label>Look</Label>
              <Tabs value={style} onValueChange={(v) => setStyle(v as "knitted" | "flat")}>
                <TabsList className="w-full">
                  <TabsTrigger value="knitted">Knitted</TabsTrigger>
                  <TabsTrigger value="flat">Flat</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <Switch checked={showJoins} onCheckedChange={setShowJoins} />
              Show repeat edges
            </label>
          </div>

          <div ref={wrapRef} className="max-h-[75vh] overflow-auto rounded-lg border bg-muted/40">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Preview of the chart repeated ${a} times across and ${u} times up`}
              style={{ width: layout.width, height: layout.height }}
              className="block"
            />
          </div>
          {style === "knitted" && !knitted && (
            <p className="text-xs text-muted-foreground">
              Stitches are too small to draw as knitting at this size, so they&apos;re shown as flat colour. Use fewer
              repeats across to see the stitches.
            </p>
          )}

          {seamFloats.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>
                  {seamFloats.length} row{seamFloats.length === 1 ? "" : "s"}
                </strong>{" "}
                start{seamFloats.length === 1 ? "s" : ""} and end{seamFloats.length === 1 ? "s" : ""} in the same colour,
                so where one repeat meets the next the float runs longer than {chart.settings.maxFloat} sts (
                {seamFloats
                  .slice()
                  .sort((x, y) => x.row - y.row)
                  .slice(0, 8)
                  .map((f) => `row ${f.row}: ${f.length} sts`)
                  .join(", ")}
                {seamFloats.length > 8 ? ", …" : ""}). These don&apos;t show up in the chart&apos;s own float count.
                {showJoins && a > 1 ? " They're outlined in red above." : ""}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>The repeat joins cleanly: no floats longer than {chart.settings.maxFloat} sts where one repeat meets the next.</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
