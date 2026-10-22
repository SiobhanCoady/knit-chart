"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Crop,
  Download,
  FileText,
  Loader2,
  Redo2,
  RotateCcw,
  RotateCcwSquare,
  RotateCwSquare,
  Scissors,
  Undo2,
  X,
} from "lucide-react";
import {
  buildChart,
  type Chart,
  type ChartSettings,
  chartRows,
  DEFAULT_SETTINGS,
  MAX_ROWS,
  recolourCells,
} from "@/lib/chart";
import { exportPdf, exportPng } from "@/lib/export";
import { addRotation, type Rotation, rotateCrop, rotatedImageUrl } from "@/lib/rotate";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, UploadZone } from "@/components/upload-zone";
import { CropEditor } from "@/components/crop-editor";
import { ChartView, MAX_CELL, MIN_CELL } from "@/components/chart-view";
import { ColourKey, FloatList, RowSummaryList } from "@/components/chart-panels";

interface LoadedImage {
  el: HTMLImageElement;
  url: string;
  name: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new Error("This picture has no size we can read."));
    img.onerror = () => reject(new Error("We couldn't read that file as a picture. Try a PNG or JPG."));
    img.src = url;
  });
}

function baseName(name: string) {
  return (name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "chart") + "-chart";
}

function SettingRow({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {value !== undefined && <span className="text-sm font-medium tabular-nums">{value}</span>}
      </div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const sliderValue = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

const MAX_UNDO = 200;

export function KnitChartApp() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);
  const [chart, setChart] = useState<Chart | null>(null);
  const [builtFor, setBuiltFor] = useState<{ image: LoadedImage; settings: ChartSettings } | null>(null);
  const [cropping, setCropping] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const [highlightFloats, setHighlightFloats] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const [effectiveCell, setEffectiveCell] = useState(12);
  const [gauge, setGauge] = useState({ sts: "22", rows: "28" });
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [selectedCells, setSelectedCells] = useState<ReadonlySet<number>>(() => new Set());
  const [originalChart, setOriginalChart] = useState<Chart | null>(null);
  const [history, setHistory] = useState<{ past: Chart[]; future: Chart[] }>({ past: [], future: [] });
  const [panelTab, setPanelTab] = useState("key");
  const [rotation, setRotation] = useState<Rotation>(0);
  const [rotating, setRotating] = useState(false);
  const urlRef = useRef<string | null>(null);
  const rotatedUrlRef = useRef<string | null>(null);
  const originalRef = useRef<LoadedImage | null>(null);

  const update = <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const setRotatedUrl = (url: string | null) => {
    if (rotatedUrlRef.current) URL.revokeObjectURL(rotatedUrlRef.current);
    rotatedUrlRef.current = url;
  };

  const acceptImage = useCallback(async (url: string, name: string, revoke: boolean) => {
    setLoadingImage(true);
    setError(null);
    try {
      const el = await loadImage(url);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = revoke ? url : null;
      setRotatedUrl(null);
      originalRef.current = { el, url, name };
      setImage(originalRef.current);
      setRotation(0);
      setSettings((s) => ({ ...s, crop: null }));
      setCropping(false);
    } catch (e) {
      if (revoke) URL.revokeObjectURL(url);
      setError((e as Error).message);
    } finally {
      setLoadingImage(false);
    }
  }, []);

  const rotate = async (delta: 90 | -90) => {
    const original = originalRef.current;
    if (!original || rotating) return;
    const next = addRotation(rotation, delta);
    setRotating(true);
    try {
      if (next === 0) {
        setRotatedUrl(null);
        setImage(original);
      } else {
        const url = await rotatedImageUrl(original.el, next);
        const el = await loadImage(url);
        setRotatedUrl(url);
        setImage({ el, url, name: original.name });
      }
      setRotation(next);
      setSettings((s) => (s.crop ? { ...s, crop: rotateCrop(s.crop, delta) } : s));
    } catch (e) {
      console.error(e);
      setError("We couldn't rotate this picture. Try again, or rotate it before uploading.");
    } finally {
      setRotating(false);
    }
  };

  const onFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`“${file.name}” isn't a picture we can chart. Use a PNG, JPG, WebP, GIF or SVG.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — please use a picture under 25 MB.`);
        return;
      }
      acceptImage(URL.createObjectURL(file), file.name, true);
    },
    [acceptImage],
  );

  const onSample = useCallback(
    () => acceptImage(`${process.env.NEXT_PUBLIC_BASE_PATH}/samples/mountain-sunset.svg`, "mountain-sunset.svg", false),
    [acceptImage],
  );

  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => {
      try {
        const built = buildChart(image.el, settings);
        setChart(built);
        setOriginalChart(built);
        setHistory({ past: [], future: [] });
        setSelectedCells(new Set());
        setError(null);
      } catch (e) {
        console.error(e);
        setError("Something went wrong while building the chart. Try fewer stitches or a different picture.");
      } finally {
        setBuiltFor({ image, settings });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [image, settings]);
  const processing = !!image && (builtFor?.image !== image || builtFor.settings !== settings);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    if (rotatedUrlRef.current) URL.revokeObjectURL(rotatedUrlRef.current);
  }, []);

  const hasSelection = selectedCells.size > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedCells(new Set());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSelection]);

  const selectCells = useCallback((indices: ReadonlySet<number>) => {
    setSelectedCells(indices);
    if (indices.size) setPanelTab("key");
  }, []);

  const applyColour = (colour: number) => {
    if (!chart) return;
    const result = recolourCells(chart, selectedCells, colour);
    if (!result.changed) return;
    setHistory((h) => ({ past: [...h.past, chart].slice(-MAX_UNDO), future: [] }));
    setChart(result.chart);
  };

  const undo = () => {
    const previous = history.past.at(-1);
    if (!chart || !previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [chart, ...history.future] });
    setChart(previous);
  };

  const redo = () => {
    const [next, ...rest] = history.future;
    if (!chart || !next) return;
    setHistory({ past: [...history.past, chart], future: rest });
    setChart(next);
  };

  const onHistoryKey = useEffectEvent((e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]")) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) undo();
    else if ((key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey)) redo();
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onHistoryKey(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editedStitches = useMemo(() => {
    if (!chart || !originalChart || chart === originalChart) return 0;
    let n = 0;
    for (let i = 0; i < chart.cells.length; i++) if (chart.cells[i] !== originalChart.cells[i]) n++;
    return n;
  }, [chart, originalChart]);

  let sharedColour: number | null = null;
  if (chart && hasSelection) {
    const colours = new Set([...selectedCells].map((i) => chart.cells[i]));
    if (colours.size === 1) [sharedColour] = colours;
  }

  const applyGauge = (next: { sts: string; rows: string }) => {
    setGauge(next);
    const s = parseFloat(next.sts);
    const r = parseFloat(next.rows);
    if (s > 0 && r > 0) update("stitchAspect", Math.max(0.4, Math.min(1.5, Math.round((s / r) * 100) / 100)));
  };

  const runExport = async (kind: "png" | "pdf") => {
    if (!chart || !image) return;
    setExporting(kind);
    try {
      const name = baseName(image.name);
      if (kind === "png") exportPng(chart, { showSymbols, highlightFloats }, name);
      else await exportPdf(chart, { showSymbols, highlightFloats }, name);
      toast.success(kind === "png" ? "Chart PNG downloaded" : "Printable PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Export failed. Try again, or reduce the chart size.");
    } finally {
      setExporting(null);
    }
  };

  const projectedRows = image
    ? chartRows(image.el.naturalWidth, image.el.naturalHeight, settings)
    : null;
  const rowsClamped =
    image &&
    projectedRows === MAX_ROWS &&
    Math.round(
      (settings.stitches *
        ((image.el.naturalHeight * (settings.crop?.h ?? 1)) / (image.el.naturalWidth * (settings.crop?.w ?? 1)))) /
        settings.stitchAspect,
    ) > MAX_ROWS;

  if (!image) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-3 text-center">
          <Badge variant="secondary">Stranded colourwork ready</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Turn any picture into a knitting chart
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-muted-foreground">
            Pick how many stitches wide and how many colours, and knit-chart builds a numbered grid with a colour key —
            keeping each row to two colours for Fair Isle and flagging floats that are too long to carry.
          </p>
        </div>
        <UploadZone onFile={onFile} onSample={onSample} disabled={loadingImage} />
        {loadingImage && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading your picture…
          </p>
        )}
        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["Colours per row", "Stranded mode keeps every row to 2 (or 3) colours, recolouring stray stitches."],
            ["Float check", "Runs longer than your limit are outlined in red and listed by row and stitch."],
            ["Ready to print", "Rows numbered from the bottom, bold lines every 10, symbols per colour, PDF export."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border bg-card p-4">
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Picture</CardTitle>
            <CardDescription className="truncate">{image.name}</CardDescription>
            <CardAction className="flex gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => rotate(-90)}
                disabled={rotating || cropping}
                aria-label="Rotate picture left"
                title="Rotate left"
              >
                <RotateCcwSquare />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => rotate(90)}
                disabled={rotating || cropping}
                aria-label="Rotate picture right"
                title="Rotate right"
              >
                <RotateCwSquare />
              </Button>
              <Button
                variant={cropping ? "default" : "outline"}
                size="sm"
                onClick={() => setCropping((c) => !c)}
                aria-pressed={cropping}
              >
                <Crop data-icon="inline-start" />
                {cropping ? "Done" : "Crop"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <CropEditor
              src={image.url}
              alt={`Preview of ${image.name}`}
              crop={settings.crop}
              editing={cropping}
              onChange={(c) => update("crop", c)}
            />
            {settings.crop && (
              <Button variant="ghost" size="sm" onClick={() => update("crop", null)}>
                <Scissors data-icon="inline-start" />
                Remove crop
              </Button>
            )}
            <UploadZone onFile={onFile} compact disabled={loadingImage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chart settings</CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSettings((s) => ({ ...DEFAULT_SETTINGS, crop: s.crop }));
                  setGauge({ sts: "22", rows: "28" });
                }}
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <SettingRow
              label="Knitting style"
              hint={
                settings.mode === "stranded"
                  ? "Fair Isle-style: each row only uses its most-used colours; other stitches are recoloured to the nearest allowed one."
                  : "Unrestricted: every stitch takes its nearest colour, so rows may use any number of colours (intarsia, duplicate stitch, embroidery)."
              }
            >
              <Tabs value={settings.mode} onValueChange={(v) => update("mode", v as ChartSettings["mode"])}>
                <TabsList className="w-full">
                  <TabsTrigger value="stranded">Stranded colourwork</TabsTrigger>
                  <TabsTrigger value="general">General</TabsTrigger>
                </TabsList>
              </Tabs>
            </SettingRow>

            {settings.mode === "stranded" && (
              <SettingRow label="Colours per row" hint="Two is classic Fair Isle; three is manageable but makes a denser fabric.">
                <Tabs
                  value={String(settings.coloursPerRow)}
                  onValueChange={(v) => update("coloursPerRow", Number(v))}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="2">2 colours</TabsTrigger>
                    <TabsTrigger value="3">3 colours</TabsTrigger>
                  </TabsList>
                </Tabs>
              </SettingRow>
            )}

            <SettingRow
              label="Width"
              value={`${settings.stitches} sts`}
              hint={
                rowsClamped
                  ? `Height is capped at ${MAX_ROWS} rows — crop the picture or use fewer stitches.`
                  : `Height follows the picture: ${projectedRows} rows.`
              }
            >
              <Slider
                value={[settings.stitches]}
                min={10}
                max={200}
                step={1}
                onValueChange={(v) => update("stitches", sliderValue(v))}
                aria-label="Chart width in stitches"
              />
            </SettingRow>

            <SettingRow
              label="Colours"
              value={settings.colours}
              hint="The picture is reduced to this many yarn colours using k-means clustering."
            >
              <Slider
                value={[settings.colours]}
                min={2}
                max={12}
                step={1}
                onValueChange={(v) => update("colours", sliderValue(v))}
                aria-label="Number of colours"
              />
            </SettingRow>

            <SettingRow
              label="Longest float allowed"
              value={`${settings.maxFloat} sts`}
              hint="Runs of one colour longer than this leave a long strand on the back that should be caught."
            >
              <Slider
                value={[settings.maxFloat]}
                min={2}
                max={15}
                step={1}
                onValueChange={(v) => update("maxFloat", sliderValue(v))}
                aria-label="Maximum float length"
              />
            </SettingRow>

            <SettingRow
              label="Stitch shape (height ÷ width)"
              value={settings.stitchAspect.toFixed(2)}
              hint="Knit stitches are wider than they are tall, so the chart gets more rows than stitches to keep the picture in proportion."
            >
              <Slider
                value={[settings.stitchAspect]}
                min={0.5}
                max={1.2}
                step={0.01}
                onValueChange={(v) => update("stitchAspect", sliderValue(v))}
                aria-label="Stitch aspect ratio"
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">From gauge:</span>
                <Input
                  className="h-7 w-14 text-center"
                  inputMode="decimal"
                  aria-label="Stitches per 10 cm"
                  value={gauge.sts}
                  onChange={(e) => applyGauge({ ...gauge, sts: e.target.value })}
                />
                <span className="text-muted-foreground">sts ×</span>
                <Input
                  className="h-7 w-14 text-center"
                  inputMode="decimal"
                  aria-label="Rows per 10 cm"
                  value={gauge.rows}
                  onChange={(e) => applyGauge({ ...gauge, rows: e.target.value })}
                />
                <span className="text-muted-foreground">rows</span>
              </div>
            </SettingRow>
          </CardContent>
        </Card>
      </aside>

      <section className="min-w-0 space-y-6">
        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Your chart
              {chart && (
                <>
                  <Badge variant="secondary">
                    {chart.width} × {chart.height}
                  </Badge>
                  <Badge variant="secondary">{chart.palette.length} colours</Badge>
                  <Badge variant={chart.floats.length ? "destructive" : "secondary"} data-testid="float-count">
                    {chart.floats.length} long float{chart.floats.length === 1 ? "" : "s"}
                  </Badge>
                  {editedStitches > 0 && (
                    <Badge variant="outline" title="Changing the picture or chart settings rebuilds the chart and discards edits.">
                      {editedStitches} stitch{editedStitches === 1 ? "" : "es"} edited
                    </Badge>
                  )}
                </>
              )}
              {processing && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating chart" />}
            </CardTitle>
            <CardAction className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!chart || !!exporting} onClick={() => runExport("png")}>
                {exporting === "png" ? <Loader2 className="animate-spin" /> : <Download data-icon="inline-start" />}
                PNG
              </Button>
              <Button size="sm" disabled={!chart || !!exporting} onClick={() => runExport("pdf")}>
                {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <FileText data-icon="inline-start" />}
                PDF
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!history.past.length}
                  onClick={undo}
                  title="Undo colour change (⌘Z / Ctrl+Z)"
                >
                  <Undo2 data-icon="inline-start" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!history.future.length}
                  onClick={redo}
                  title="Redo colour change (⇧⌘Z / Ctrl+Y)"
                >
                  <Redo2 data-icon="inline-start" />
                  Redo
                </Button>
              </div>
              <label className="flex items-center gap-2">
                <Switch checked={highlightFloats} onCheckedChange={setHighlightFloats} />
                Highlight long floats
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={showSymbols} onCheckedChange={setShowSymbols} />
                Symbols
              </label>
              <div className="flex min-w-56 flex-1 items-center gap-3 sm:max-w-80">
                <span className="text-muted-foreground">Zoom</span>
                <Slider
                  value={[effectiveCell]}
                  min={MIN_CELL}
                  max={MAX_CELL}
                  step={0.5}
                  onValueChange={(v) => setZoom(sliderValue(v))}
                  aria-label="Zoom"
                />
                <Button variant={zoom === null ? "secondary" : "outline"} size="xs" onClick={() => setZoom(null)}>
                  Fit
                </Button>
              </div>
            </div>
            {chart ? (
              <div className={processing ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <ChartView
                  chart={chart}
                  zoom={zoom}
                  showSymbols={showSymbols}
                  highlightFloats={highlightFloats}
                  onCellChange={setEffectiveCell}
                  selected={selectedCells}
                  onSelect={selectCells}
                />
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Building your chart…
              </div>
            )}
          </CardContent>
        </Card>

        {chart && (
          <Card>
            <CardContent>
              <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as string)}>
                <TabsList>
                  <TabsTrigger value="key">Colour key</TabsTrigger>
                  <TabsTrigger value="floats">
                    Floats
                    <Badge variant={chart.floats.length ? "destructive" : "secondary"} className="ml-1">
                      {chart.floats.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="rows">Colours per row</TabsTrigger>
                </TabsList>
                <TabsContent value="key" className="pt-3">
                  <ColourKey
                    chart={chart}
                    selectedCount={selectedCells.size}
                    activeColour={sharedColour}
                    onPick={applyColour}
                  />
                </TabsContent>
                <TabsContent value="floats" className="pt-3">
                  <FloatList chart={chart} />
                </TabsContent>
                <TabsContent value="rows" className="pt-3">
                  <RowSummaryList chart={chart} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function ErrorNote({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <p className="flex-1">{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
