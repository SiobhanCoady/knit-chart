"use client";

import { FolderOpen, Trash2 } from "lucide-react";
import { type SavedDesign } from "@/lib/designs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function timeAgo(ms: number) {
  const minutes = Math.round((ms - Date.now()) / 60000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -30) return relative.format(days, "day");
  return new Date(ms).toLocaleDateString();
}

export function SavedDesigns({
  designs,
  onOpen,
  onDelete,
}: {
  designs: SavedDesign[];
  onOpen: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your designs</CardTitle>
        <CardDescription>
          Saved automatically in this browser as you work. Clearing your browser data removes them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="saved-designs">
          {designs.map((d) => (
            <li key={d.id} className="flex gap-3 rounded-lg border bg-card p-3">
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40"
                aria-label={`Open ${d.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail */}
                <img src={d.thumbnail} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" />
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-medium" title={d.name}>
                  {d.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.width} × {d.height} · {d.palette.length} colours
                </p>
                <p className="text-xs text-muted-foreground">Edited {timeAgo(d.updatedAt)}</p>
                <div className="mt-auto flex gap-1.5 pt-2">
                  <Button size="xs" variant="outline" onClick={() => onOpen(d)}>
                    <FolderOpen data-icon="inline-start" />
                    Open
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onDelete(d)}
                    aria-label={`Delete ${d.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
