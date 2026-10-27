"use client";

import { useId, useState } from "react";
import { BLANK_LIMITS } from "@/lib/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function parseSize(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

export function SizeForm({
  initialWidth,
  initialHeight,
  submitLabel,
  submitIcon,
  requireChange = false,
  onSubmit,
}: {
  initialWidth: number;
  initialHeight: number;
  submitLabel: string;
  submitIcon?: React.ReactNode;
  /** Disable the button until the size differs from the initial one. */
  requireChange?: boolean;
  onSubmit: (width: number, height: number) => void;
}) {
  const id = useId();
  const [width, setWidth] = useState(String(initialWidth));
  const [height, setHeight] = useState(String(initialHeight));
  const w = parseSize(width, BLANK_LIMITS.minStitches, BLANK_LIMITS.maxStitches);
  const h = parseSize(height, BLANK_LIMITS.minRows, BLANK_LIMITS.maxRows);
  const unchanged = w === initialWidth && h === initialHeight;
  const disabled = w === null || h === null || (requireChange && unchanged);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit(w!, h!);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-w`}>Width</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id={`${id}-w`}
              inputMode="numeric"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              aria-invalid={w === null}
              className="h-8 w-20 text-center tabular-nums"
            />
            <span className="text-sm text-muted-foreground">sts</span>
          </div>
        </div>
        <span className="pb-1.5 text-muted-foreground">×</span>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-h`}>Height</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id={`${id}-h`}
              inputMode="numeric"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              aria-invalid={h === null}
              className="h-8 w-20 text-center tabular-nums"
            />
            <span className="text-sm text-muted-foreground">rows</span>
          </div>
        </div>
        <Button type="submit" disabled={disabled}>
          {submitIcon}
          {submitLabel}
        </Button>
      </div>
      <p className={w === null || h === null ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        Up to {BLANK_LIMITS.maxStitches} stitches wide and {BLANK_LIMITS.maxRows} rows tall.
      </p>
    </form>
  );
}
