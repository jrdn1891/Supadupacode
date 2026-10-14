import type { PointerEvent as ReactPointerEvent } from "react";

import { endSceneDrag, type SceneDropTarget, sceneDropTargetAt, showSceneDrag } from "./sceneDrag";

const DRAG_DISTANCE = 4;
const VELOCITY_WINDOW_MS = 80;

export interface SceneDragRelease {
  readonly target: SceneDropTarget | null;
  readonly travelY: number;
  readonly velocityY: number;
}

export function beginSceneDrag(
  event: ReactPointerEvent<HTMLElement>,
  input: {
    readonly title: string;
    readonly exceptPaneId?: string;
    readonly onRelease: (release: SceneDragRelease) => void;
  },
) {
  if (event.button !== 0) return;
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const samples: Array<{ readonly y: number; readonly t: number }> = [];
  let dragging = false;
  const targetAt = (moved: PointerEvent) =>
    sceneDropTargetAt(
      { x: moved.clientX, y: moved.clientY },
      input.exceptPaneId === undefined ? {} : { exceptPaneId: input.exceptPaneId },
    );
  const onMove = (moved: PointerEvent) => {
    if (!dragging && Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < DRAG_DISTANCE)
      return;
    dragging = true;
    samples.push({ y: moved.clientY, t: moved.timeStamp });
    while (samples.length > 2 && moved.timeStamp - samples[0]!.t > VELOCITY_WINDOW_MS)
      samples.shift();
    showSceneDrag(targetAt(moved), { x: moved.clientX, y: moved.clientY, title: input.title });
  };
  const finish = (released: PointerEvent | null) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKeyDown, true);
    endSceneDrag();
    if (!dragging || released === null) return;
    const first = samples[0];
    const last = samples.at(-1);
    input.onRelease({
      target: targetAt(released),
      travelY: released.clientY - start.y,
      velocityY: first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0,
    });
  };
  const onUp = (released: PointerEvent) => finish(released);
  const onCancel = () => finish(null);
  const onKeyDown = (pressed: KeyboardEvent) => {
    if (pressed.key !== "Escape") return;
    pressed.preventDefault();
    pressed.stopPropagation();
    finish(null);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKeyDown, true);
}
