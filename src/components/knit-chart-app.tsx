"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Crop,
  Download,
  FileText,
  Grid3x3,
  Loader2,
  Plus,
  Scaling,
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
  addPaletteColour,
  applyChartSettings,
  createBlankChart,
  recolourCells,
  resizeChart,
  type RGB,
  setPaletteColour,
} from "@/lib/chart";
import {
  deleteDesign,
  designFromChart,
  designToChart,
  listDesigns,
  saveDesign,
  type SavedDesign,
  UNTITLED,
} from "@/lib/designs";
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
import { RepeatPreview } from "@/components/repeat-preview";
import { SizeForm } from "@/components/size-form";
import { SavedDesigns } from "@/components/saved-designs";

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

function nameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

interface DesignMeta {
  id: string;
  createdAt: number;
  source: SavedDesign["source"];
}

function newDesign(source: SavedDesign["source"]): DesignMeta {
  return { id: crypto.randomUUID(), createdAt: Date.now(), source };
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
  const [rawChart, setChart] = useState<Chart | null>(null);
  const [blank, setBlank] = useState(false);
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
  const [design, setDesign] = useState<DesignMeta | null>(null);
  const [name, setName] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const persistedRef = useRef(new Set<string>());
  const lastSavedRef = useRef<{ chart: Chart | null; name: string }>({ chart: null, name: "" });
  const urlRef = useRef<string | null>(null);
  const rotatedUrlRef = useRef<string | null>(null);
  const originalRef = useRef<LoadedImage | null>(null);

  const update = <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  // Blank charts aren't rebuilt from a picture, so setting changes are applied to whatever is being drawn.
  const chart = useMemo(
    () =>
      blank && rawChart
        ? applyChartSettings(rawChart, { maxFloat: settings.maxFloat, stitchAspect: settings.stitchAspect })
        : rawChart,
    [blank, rawChart, settings.maxFloat, settings.stitchAspect],
  );

  const resetEditing = (next: Chart | null) => {
    setChart(next);
    setOriginalChart(null);
    setHistory({ past: [], future: [] });
    setSelectedCells(new Set());
    setPanelTab("key");
  };

  const beginDesign = (meta: DesignMeta, designName: string) => {
    setDesign(meta);
    setName(designName);
    setSavedAt(null);
  };

  const startBlank = (width: number, height: number) => {
    setImage(null);
    setBlank(true);
    setError(null);
    beginDesign(newDesign("blank"), "");
    resetEditing(createBlankChart(width, height, settings));
  };

  // An untouched blank grid isn't worth keeping; anything named, edited or built from a picture is.
  const saveCurrent = async () => {
    if (!chart || !design || processing) return;
    const worthSaving =
      persistedRef.current.has(design.id) || design.source === "picture" || !!name.trim() || history.past.length > 0;
    if (!worthSaving) return;
    if (lastSavedRef.current.chart === chart && lastSavedRef.current.name === name) return;
    try {
      await saveDesign(designFromChart(chart, { ...design, name: name.trim() || UNTITLED }));
      persistedRef.current.add(design.id);
      lastSavedRef.current = { chart, name };
      setSavedAt(Date.now());
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save this design in your browser. Export a PNG or PDF to keep a copy.", {
        id: "save-failed",
      });
    }
  };

  const startOver = async () => {
    await saveCurrent();
    setImage(null);
    setBlank(false);
    setError(null);
    setDesign(null);
    resetEditing(null);
  };

  const openDesign = (saved: SavedDesign) => {
    setImage(null);
    setBlank(true);
    setError(null);
    setSettings({ ...DEFAULT_SETTINGS, ...saved.settings, crop: null });
    const restored = designToChart(saved);
    const savedName = saved.name === UNTITLED ? "" : saved.name;
    persistedRef.current.add(saved.id);
    lastSavedRef.current = { chart: restored, name: savedName };
    beginDesign({ id: saved.id, createdAt: saved.createdAt, source: saved.source }, savedName);
    setSavedAt(saved.updatedAt);
    resetEditing(restored);
  };

  const removeDesign = async (saved: SavedDesign) => {
    setSavedDesigns((list) => list.filter((d) => d.id !== saved.id));
    try {
      await deleteDesign(saved.id);
      toast(`Deleted “${saved.name}”`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await saveDesign(saved);
            setSavedDesigns(await listDesigns());
          },
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't delete that design.");
      setSavedDesigns(await listDesigns());
    }
  };

  const onHome = !image && !blank;
  useEffect(() => {
    if (!onHome) return;
    let cancelled = false;
    listDesigns()
      .then((list) => !cancelled && setSavedDesigns(list))
      .catch((e) => console.error("Couldn't read saved designs", e));
    return () => {
      cancelled = true;
    };
  }, [onHome]);

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
      setDesign(newDesign("picture"));
      setName(nameFromFile(name));
      setSavedAt(null);
      setBlank(false);
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

  const onAutosave = useEffectEvent(() => {
    saveCurrent();
  });
  useEffect(() => {
    if (!chart || !design || processing) return;
    const t = setTimeout(onAutosave, 500);
    return () => clearTimeout(t);
  }, [chart, name, design, processing]);

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

  const commitEdit = (next: Chart) => {
    if (!chart || next === chart) return;
    setHistory((h) => ({ past: [...h.past, chart].slice(-MAX_UNDO), future: [] }));
    setChart(next);
  };

  const applyColour = (colour: number) => {
    if (chart) commitEdit(recolourCells(chart, selectedCells, colour).chart);
  };

  const changePaletteColour = (index: number, rgb: RGB) => {
    if (chart) commitEdit(setPaletteColour(chart, index, rgb));
  };

  const addColour = (rgb: RGB) => {
    if (chart) commitEdit(addPaletteColour(chart, rgb));
  };

  const resizeBlank = (width: number, height: number) => {
    if (!chart) return;
    setSelectedCells(new Set());
    commitEdit(resizeChart(chart, width, height));
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
    if (!chart) return;
    setExporting(kind);
    try {
      const title = name.trim() || UNTITLED;
      if (kind === "png") exportPng(chart, { showSymbols, highlightFloats }, title);
      else await exportPdf(chart, { showSymbols, highlightFloats }, title);
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

  if (onHome) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-3 text-center">
          <Badge variant="secondary">Stranded colourwork ready</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Turn a picture into a knitting chart, or design your own
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-muted-foreground">
            Upload a picture and knit-chart builds a numbered grid with a colour key — keeping each row to two colours
            for Fair Isle and flagging floats that are too long to carry. Or start from an empty grid and draw your
            motif stitch by stitch.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <UploadZone onFile={onFile} onSample={onSample} disabled={loadingImage} />
          <Card className="justify-center">
            <CardHeader>
              <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Grid3x3 className="size-7" />
              </div>
              <CardTitle className="text-lg font-semibold">Start with a blank chart</CardTitle>
              <CardDescription>
                Choose a size, then click or drag across stitches and pick colours from the key. You can resize it
                later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SizeForm
                initialWidth={24}
                initialHeight={20}
                submitLabel="Create chart"
                submitIcon={<Plus data-icon="inline-start" />}
                onSubmit={startBlank}
              />
            </CardContent>
          </Card>
        </div>
        {loadingImage && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading your picture…
          </p>
        )}
        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        {savedDesigns.length > 0 && (
          <SavedDesigns designs={savedDesigns} onOpen={openDesign} onDelete={removeDesign} />
        )}
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

  const floatSetting = (
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
  );

  const stitchShapeSetting = (
    <SettingRow
      label="Stitch shape (height ÷ width)"
      value={settings.stitchAspect.toFixed(2)}
      hint={
        image
          ? "Knit stitches are wider than they are tall, so the chart gets more rows than stitches to keep the picture in proportion."
          : "Knit stitches are wider than they are tall. Matching your gauge shows the motif in its knitted proportions."
      }
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
  );

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <Button variant="ghost" size="sm" onClick={startOver} className="-my-2 -ml-2">
          <ArrowLeft data-icon="inline-start" />
          New chart
        </Button>
        {image ? (
          <>
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

                {floatSetting}
                {stitchShapeSetting}
              </CardContent>
            </Card>
          </>
        ) : (
          chart && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Chart size</CardTitle>
                  <CardDescription>
                    {chart.width} sts × {chart.height} rows
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SizeForm
                    key={`${chart.width}x${chart.height}`}
                    initialWidth={chart.width}
                    initialHeight={chart.height}
                    submitLabel="Resize"
                    submitIcon={<Scaling data-icon="inline-start" />}
                    requireChange
                    onSubmit={resizeBlank}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Rows are added or removed at the top and stitches at the left, so row 1 and stitch 1 stay put. New
                    stitches are colour A. Resizing can be undone.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Chart settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {floatSetting}
                  {stitchShapeSetting}
                </CardContent>
              </Card>
            </>
          )
        )}
      </aside>

      <section className="min-w-0 space-y-6">
        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={UNTITLED}
                maxLength={80}
                aria-label="Design name"
                className="h-9 w-full max-w-sm text-lg font-semibold md:text-lg"
              />
              {savedAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="saved-status">
                  <Check className="size-3.5" />
                  Saved in this browser
                </span>
              )}
            </div>
            <CardTitle className="flex flex-wrap items-center gap-2">
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
                    onChangeColour={changePaletteColour}
                    onAddColour={addColour}
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

        {chart && <RepeatPreview chart={chart} />}
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
