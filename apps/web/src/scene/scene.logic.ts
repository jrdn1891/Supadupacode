import { scopedThreadKey } from "@supacode/client-runtime/environment";

import type { ThreadRouteTarget } from "../threadRoutes";

export interface ScenePane {
  readonly id: string;
  readonly target: ThreadRouteTarget;
}

export interface SceneColumn {
  readonly id: string;
  readonly panes: ReadonlyArray<ScenePane>;
}

export interface Scene {
  readonly columns: ReadonlyArray<SceneColumn>;
  readonly focusedPaneId: string | null;
  readonly spotlightPaneId: string | null;
}

export type ScenePlacement = "right" | "below";

export const EMPTY_SCENE: Scene = { columns: [], focusedPaneId: null, spotlightPaneId: null };

export function sceneTargetKey(target: ThreadRouteTarget): string {
  return target.kind === "server" ? scopedThreadKey(target.threadRef) : `draft:${target.draftId}`;
}

export function scenePanes(scene: Scene): ReadonlyArray<ScenePane> {
  return scene.columns.flatMap((column) => column.panes);
}

export function findScenePane(scene: Scene, paneId: string | null): ScenePane | null {
  return scenePanes(scene).find((pane) => pane.id === paneId) ?? null;
}

function findPaneByTarget(scene: Scene, target: ThreadRouteTarget): ScenePane | null {
  const key = sceneTargetKey(target);
  return scenePanes(scene).find((pane) => sceneTargetKey(pane.target) === key) ?? null;
}

function mapPanes(scene: Scene, update: (pane: ScenePane) => ScenePane): Scene {
  return {
    ...scene,
    columns: scene.columns.map((column) => ({ ...column, panes: column.panes.map(update) })),
  };
}

export function focusScenePane(scene: Scene, paneId: string): Scene {
  if (scene.focusedPaneId === paneId || findScenePane(scene, paneId) === null) return scene;
  return {
    ...scene,
    focusedPaneId: paneId,
    spotlightPaneId: scene.spotlightPaneId === null ? null : paneId,
  };
}

export function syncSceneRoute(
  scene: Scene,
  target: ThreadRouteTarget,
  ids: { readonly paneId: string; readonly columnId: string },
): Scene {
  const existing = findPaneByTarget(scene, target);
  if (existing !== null) return focusScenePane(scene, existing.id);
  const focused = findScenePane(scene, scene.focusedPaneId);
  if (focused === null) {
    return {
      columns: [{ id: ids.columnId, panes: [{ id: ids.paneId, target }] }],
      focusedPaneId: ids.paneId,
      spotlightPaneId: null,
    };
  }
  return mapPanes(scene, (pane) => (pane.id === focused.id ? { ...pane, target } : pane));
}

export function retargetScenePane(scene: Scene, paneId: string, target: ThreadRouteTarget): Scene {
  const existing = findPaneByTarget(scene, target);
  if (existing !== null && existing.id !== paneId) return closeScenePane(scene, paneId);
  return mapPanes(scene, (pane) => (pane.id === paneId ? { ...pane, target } : pane));
}

export function openScenePane(
  scene: Scene,
  target: ThreadRouteTarget,
  placement: ScenePlacement,
  ids: { readonly paneId: string; readonly columnId: string },
): Scene {
  const existing = findPaneByTarget(scene, target);
  if (existing !== null) return { ...focusScenePane(scene, existing.id), spotlightPaneId: null };
  const pane: ScenePane = { id: ids.paneId, target };
  const focusedColumnIndex = scene.columns.findIndex((column) =>
    column.panes.some((candidate) => candidate.id === scene.focusedPaneId),
  );
  const anchorIndex = focusedColumnIndex === -1 ? scene.columns.length - 1 : focusedColumnIndex;
  const columns =
    placement === "right" || anchorIndex === -1
      ? [
          ...scene.columns.slice(0, anchorIndex + 1),
          { id: ids.columnId, panes: [pane] },
          ...scene.columns.slice(anchorIndex + 1),
        ]
      : scene.columns.map((column, index) => {
          if (index !== anchorIndex) return column;
          const at = column.panes.findIndex((candidate) => candidate.id === scene.focusedPaneId);
          const insertAt = at === -1 ? column.panes.length : at + 1;
          return {
            ...column,
            panes: [...column.panes.slice(0, insertAt), pane, ...column.panes.slice(insertAt)],
          };
        });
  return { columns, focusedPaneId: pane.id, spotlightPaneId: null };
}

export function closeScenePane(scene: Scene, paneId: string): Scene {
  const panes = scenePanes(scene);
  const index = panes.findIndex((pane) => pane.id === paneId);
  if (index === -1 || panes.length === 1) return scene;
  const columns = scene.columns
    .map((column) => ({ ...column, panes: column.panes.filter((pane) => pane.id !== paneId) }))
    .filter((column) => column.panes.length > 0);
  const remaining = columns.flatMap((column) => column.panes);
  const focusedPaneId =
    scene.focusedPaneId === paneId ? remaining[Math.max(0, index - 1)]!.id : scene.focusedPaneId;
  return {
    columns,
    focusedPaneId,
    spotlightPaneId: scene.spotlightPaneId === paneId ? null : scene.spotlightPaneId,
  };
}

export function toggleSceneSpotlight(scene: Scene, paneId: string): Scene {
  if (findScenePane(scene, paneId) === null) return scene;
  return scene.spotlightPaneId === paneId
    ? { ...scene, spotlightPaneId: null }
    : { ...scene, focusedPaneId: paneId, spotlightPaneId: paneId };
}

export function adjacentScenePaneId(scene: Scene, direction: 1 | -1): string | null {
  const panes = scenePanes(scene);
  if (panes.length < 2) return null;
  const index = panes.findIndex((pane) => pane.id === scene.focusedPaneId);
  return panes[(index + direction + panes.length) % panes.length]!.id;
}
