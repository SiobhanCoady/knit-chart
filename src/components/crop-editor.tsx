"use client";

import { useRef, useState } from "react";
import type { CropRect } from "@/lib/chart";
import { cn } from "@/lib/utils";

interface CropEditorProps {
  src: string;
  alt: string;
  crop: CropRect | null;
  editing: boolean;
  onChange: (crop: CropRect | null) => void;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function CropEditor({ src, alt, crop, editing, onChange }: CropEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<CropRect | null>(null);
  const shown = draft ?? crop;

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  return (
    <div
      ref={ref}
      className={cn("relative mx-auto w-fit overflow-hidden rounded-lg select-none", editing && "cursor-crosshair touch-none")}
      onPointerDown={(e) => {
        if (!editing) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = point(e);
        setDraft({ ...start.current, w: 0, h: 0 });
      }}
      onPointerMove={(e) => {
        if (!editing || !start.current) return;
        const p = point(e);
        const s = start.current;
        setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
      }}
      onPointerUp={() => {
        if (!editing || !start.current) return;
        start.current = null;
        // Treat tiny drags as clicks so a stray tap doesn't crop to a sliver.
        if (draft && draft.w > 0.03 && draft.h > 0.03) onChange(draft);
        setDraft(null);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img src={src} alt={alt} className="block max-h-72 w-auto max-w-full" draggable={false} />
      {shown && shown.w > 0 && (
        <div
          className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
          style={{
            left: `${shown.x * 100}%`,
            top: `${shown.y * 100}%`,
            width: `${shown.w * 100}%`,
            height: `${shown.h * 100}%`,
          }}
        />
      )}
      {editing && !shown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-xs text-white">
          Drag across the picture to choose the area to chart
        </div>
      )}
    </div>
  );
}
