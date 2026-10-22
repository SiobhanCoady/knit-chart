"use client";

import { useRef, useState } from "react";
import { ImageUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/bmp"];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface UploadZoneProps {
  onFile: (file: File) => void;
  onSample?: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export function UploadZone({ onFile, onSample, compact, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a picture"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !disabled) onFile(file);
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card text-center transition-colors outline-none hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50",
        dragging && "border-primary bg-primary/10",
        compact ? "gap-1 px-4 py-4" : "gap-3 px-6 py-14 sm:py-20",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 text-primary",
          compact ? "size-8" : "size-14",
        )}
      >
        <ImageUp className={compact ? "size-4" : "size-7"} />
      </div>
      {compact ? (
        <p className="text-sm font-medium">Drop a new picture or click to replace</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Drop a picture here, or click to choose one</p>
            <p className="text-sm text-muted-foreground">
              PNG, JPG, WebP, GIF or SVG up to 25 MB. Everything happens in your browser — nothing is uploaded.
            </p>
          </div>
          {onSample && (
            <Button
              variant="outline"
              size="lg"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                onSample();
              }}
            >
              <Sparkles data-icon="inline-start" />
              Try the sample picture
            </Button>
          )}
        </>
      )}
    </div>
  );
}
