import { useSyncExternalStore } from "react";

import { type SceneDropZone, sceneDropZone } from "./scene.logic";

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type SceneDropTarget =
  | {
      readonly kind: "pane";
      readonly paneId: string;
      readonly zone: SceneDropZone;
      readonly rect: Rect;
    }
  | { readonly kind: "backstage"; readonly rect: Rect };

export interface SceneDragView {
  readonly preview: Rect | null;
  readonly ghost: { readonly x: number; readonly y: number; readonly title: string } | null;
}

const IDLE: SceneDragView = { preview: null, ghost: null };
let view = IDLE;
let snappedTo: string | null = null;
const listeners = new Set<() => void>();

function setView(next: SceneDragView) {
  view = next;
  for (const listener of listeners) listener();
}

export function useSceneDragView(): SceneDragView {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => view,
    () => IDLE,
  );
}

function zoneRect(rect: Rect, zone: SceneDropZone): Rect {
  switch (zone) {
    case "left":
      return { ...rect, width: rect.width / 2 };
    case "right":
      return { ...rect, left: rect.left + rect.width / 2, width: rect.width / 2 };
    case "top":
      return { ...rect, height: rect.height / 2 };
    case "bottom":
      return { ...rect, top: rect.top + rect.height / 2, height: rect.height / 2 };
    case "center":
      return rect;
  }
}

export function sceneDropTargetAt(
  point: Point,
  options: { readonly exceptPaneId?: string; readonly yieldToComposer?: boolean } = {},
): SceneDropTarget | null {
  const element = document.elementFromPoint(point.x, point.y);
  if (element === null) return null;
  const backstage = element.closest<HTMLElement>("[data-scene-backstage]");
  if (backstage !== null) return { kind: "backstage", rect: backstage.getBoundingClientRect() };
  if (options.yieldToComposer && element.closest("[data-thread-context-drop]") !== null)
    return null;
  const pane = element.closest<HTMLElement>("[data-scene-pane]");
  const paneId = pane?.dataset.scenePane;
  if (pane == null || paneId === undefined || paneId === options.exceptPaneId) return null;
  const rect = pane.getBoundingClientRect();
  return { kind: "pane", paneId, zone: sceneDropZone(rect, point), rect };
}

function targetKey(target: SceneDropTarget | null): string | null {
  return target === null
    ? null
    : target.kind === "pane"
      ? `${target.paneId}:${target.zone}`
      : "backstage";
}

export function showSceneDrag(target: SceneDropTarget | null, ghost: SceneDragView["ghost"]) {
  const key = targetKey(target);
  if (key !== snappedTo && key !== null) void window.desktopBridge?.performHaptic?.("alignment");
  snappedTo = key;
  setView({
    preview:
      target === null
        ? null
        : target.kind === "pane"
          ? zoneRect(target.rect, target.zone)
          : target.rect,
    ghost,
  });
}

export function endSceneDrag() {
  snappedTo = null;
  if (view !== IDLE) setView(IDLE);
}
