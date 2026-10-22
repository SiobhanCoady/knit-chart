import type { CropRect } from "./chart";

export type Rotation = 0 | 90 | 180 | 270;

/** Charts are at most a few hundred stitches across, so a larger rotated copy adds nothing but encoding time. */
const MAX_ROTATED_SIDE = 2400;

export function addRotation(rotation: Rotation, delta: 90 | -90): Rotation {
  return (((rotation + delta) % 360) + 360) % 360 as Rotation;
}

/** Draw the image turned clockwise by `rotation` degrees and return a PNG object URL. */
export function rotatedImageUrl(img: HTMLImageElement, rotation: Exclude<Rotation, 0>): Promise<string> {
  const scale = Math.min(1, MAX_ROTATED_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const sideways = rotation !== 180;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? h : w;
  canvas.height = sideways ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Rotation failed."))), "image/png"),
  );
}

/** Move a crop rectangle so it covers the same part of the picture after a quarter turn. */
export function rotateCrop(crop: CropRect, delta: 90 | -90): CropRect {
  return delta === 90
    ? { x: 1 - (crop.y + crop.h), y: crop.x, w: crop.h, h: crop.w }
    : { x: crop.y, y: 1 - (crop.x + crop.w), w: crop.h, h: crop.w };
}
