import type { AquariumPen } from "@supacode/client-runtime/aquarium/paint";

const OPACITY_STEPS = 32;

export interface PenPath {
  readonly key: string;
  readonly color: string;
  readonly opacity: number;
  readonly d: string;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  width: number;
  readonly height: number;
}

interface Batch {
  readonly color: string;
  readonly opacity: number;
  readonly rects: Rect[];
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function coveredAfter(batches: ReadonlyArray<Batch>, index: number, rect: Rect) {
  for (let above = index + 1; above < batches.length; above++) {
    const batch = batches[above]!;
    if (
      rect.x < batch.right &&
      rect.x + rect.width > batch.left &&
      rect.y < batch.bottom &&
      rect.y + rect.height > batch.top
    )
      return true;
  }
  return false;
}

export function recordPaths(paint: (pen: AquariumPen) => void): ReadonlyArray<PenPath> {
  const batches: Batch[] = [];
  const latest = new Map<string, number>();
  let opacity = 1;
  paint({
    alpha(value) {
      opacity = Math.round(value * OPACITY_STEPS) / OPACITY_STEPS;
    },
    fill(color, x, y, width, height) {
      if (opacity === 0) return;
      const key = `${color}@${opacity}`;
      const rect = { x, y, width, height };
      const index = latest.get(key);
      const batch =
        index === undefined || coveredAfter(batches, index, rect) ? undefined : batches[index];
      if (batch === undefined) {
        latest.set(key, batches.length);
        batches.push({
          color,
          opacity,
          rects: [rect],
          left: x,
          top: y,
          right: x + width,
          bottom: y + height,
        });
        return;
      }
      const last = batch.rects.at(-1)!;
      if (last.y === y && last.height === height && last.x + last.width === x) last.width += width;
      else batch.rects.push(rect);
      batch.left = Math.min(batch.left, x);
      batch.top = Math.min(batch.top, y);
      batch.right = Math.max(batch.right, x + width);
      batch.bottom = Math.max(batch.bottom, y + height);
    },
  });
  const seen = new Map<string, number>();
  return batches.map((batch) => {
    const key = `${batch.color}@${batch.opacity}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return {
      key: `${key}#${occurrence}`,
      color: batch.color,
      opacity: batch.opacity,
      d: batch.rects
        .map((rect) => `M${rect.x} ${rect.y}h${rect.width}v${rect.height}H${rect.x}z`)
        .join(""),
    };
  });
}
