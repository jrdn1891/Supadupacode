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

export interface SceneDropTarget {
  readonly paneId: string;
  readonly zone: SceneDropZone;
  readonly preview: Rect;
}

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

function boundsOf(element: Element): Rect {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

function zoneRect(pane: Rect, column: Rect, zone: SceneDropZone): Rect {
  switch (zone) {
    case "left":
      return { ...column, width: column.width / 2 };
    case "right":
      return { ...column, left: column.left + column.width / 2, width: column.width / 2 };
    case "top":
      return { ...pane, height: pane.height / 2 };
    case "bottom":
      return { ...pane, top: pane.top + pane.height / 2, height: pane.height / 2 };
    case "center":
      return pane;
  }
}

export function sceneDropTargetAt(
  point: Point,
  options: { readonly exceptPaneId?: string; readonly yieldToComposer?: boolean } = {},
): SceneDropTarget | null {
  const element = document.elementFromPoint(point.x, point.y);
  if (element === null) return null;
  if (options.yieldToComposer && element.closest("[data-thread-context-drop]") !== null)
    return null;
  const pane = element.closest<HTMLElement>("[data-scene-pane]");
  const paneId = pane?.dataset.scenePane;
  if (pane == null || paneId === undefined || paneId === options.exceptPaneId) return null;
  const rect = boundsOf(pane);
  const zone = sceneDropZone(rect, point);
  const column = boundsOf(pane.closest("[data-scene-column]") ?? pane);
  return { paneId, zone, preview: zoneRect(rect, column, zone) };
}

export function showSceneDrag(target: SceneDropTarget | null, ghost: SceneDragView["ghost"]) {
  const key = target === null ? null : `${target.paneId}:${target.zone}`;
  if (key !== snappedTo && key !== null) void window.desktopBridge?.performHaptic?.("alignment");
  snappedTo = key;
  setView({ preview: target?.preview ?? null, ghost });
}

export function endSceneDrag() {
  snappedTo = null;
  if (view !== IDLE) setView(IDLE);
}
