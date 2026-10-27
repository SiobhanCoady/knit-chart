import { type Chart, type ChartSettings, type PaletteEntry, restoreChart } from "./chart";

export interface SavedDesign {
  id: string;
  name: string;
  source: "picture" | "blank";
  createdAt: number;
  updatedAt: number;
  /** Small PNG data URL for the design list. */
  thumbnail: string;
  width: number;
  height: number;
  cells: Uint8Array;
  palette: Pick<PaletteEntry, "rgb" | "symbol" | "label">[];
  settings: ChartSettings;
  remappedStitches: number;
}

export const UNTITLED = "Untitled design";

const DB_NAME = "knit-chart";
const STORE = "designs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listDesigns(): Promise<SavedDesign[]> {
  const all = await run<SavedDesign[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveDesign(design: SavedDesign): Promise<void> {
  await run("readwrite", (s) => s.put(design));
}

export async function deleteDesign(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export function designToChart(d: SavedDesign): Chart {
  return restoreChart(d.width, d.height, d.cells, d.palette, d.settings, d.remappedStitches);
}

export function designFromChart(
  chart: Chart,
  meta: Pick<SavedDesign, "id" | "name" | "source" | "createdAt">,
): SavedDesign {
  return {
    ...meta,
    updatedAt: Date.now(),
    thumbnail: chartThumbnail(chart),
    width: chart.width,
    height: chart.height,
    cells: chart.cells.slice(),
    palette: chart.palette.map(({ rgb, symbol, label }) => ({ rgb, symbol, label })),
    settings: chart.settings,
    remappedStitches: chart.remappedStitches,
  };
}

const THUMB_SIZE = 160;

function chartThumbnail(chart: Chart): string {
  const aspect = chart.settings.stitchAspect;
  const cell = Math.min(THUMB_SIZE / chart.width, THUMB_SIZE / (chart.height * aspect));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(chart.width * cell));
  canvas.height = Math.max(1, Math.round(chart.height * aspect * cell));
  const ctx = canvas.getContext("2d")!;
  const sx = canvas.width / chart.width;
  const sy = canvas.height / chart.height;
  for (let y = 0; y < chart.height; y++) {
    for (let x = 0; x < chart.width; x++) {
      ctx.fillStyle = chart.palette[chart.cells[y * chart.width + x]].hex;
      ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
    }
  }
  return canvas.toDataURL("image/png");
}

export function exportFileName(name: string) {
  return name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "knit-chart";
}
