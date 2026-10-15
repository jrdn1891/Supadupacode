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

export type SceneEdge = "left" | "right" | "top" | "bottom";

export type SceneDropZone = SceneEdge | "center";

interface SceneIds {
  readonly paneId: string;
  readonly columnId: string;
}

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

export function syncSceneRoute(scene: Scene, target: ThreadRouteTarget, ids: SceneIds): Scene {
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

function placePane(
  columns: ReadonlyArray<SceneColumn>,
  pane: ScenePane,
  anchorPaneId: string | null,
  edge: SceneEdge,
  columnId: string,
): ReadonlyArray<SceneColumn> {
  const anchorColumn = columns.findIndex((column) =>
    column.panes.some((candidate) => candidate.id === anchorPaneId),
  );
  if (anchorColumn === -1) return [...columns, { id: columnId, panes: [pane] }];
  if (edge === "left" || edge === "right") {
    const at = anchorColumn + (edge === "right" ? 1 : 0);
    return [...columns.slice(0, at), { id: columnId, panes: [pane] }, ...columns.slice(at)];
  }
  return columns.map((column, index) => {
    if (index !== anchorColumn) return column;
    const at =
      column.panes.findIndex((candidate) => candidate.id === anchorPaneId) +
      (edge === "bottom" ? 1 : 0);
    return { ...column, panes: [...column.panes.slice(0, at), pane, ...column.panes.slice(at)] };
  });
}

function withoutPane(
  columns: ReadonlyArray<SceneColumn>,
  paneId: string,
): ReadonlyArray<SceneColumn> {
  return columns.flatMap((column) => {
    const panes = column.panes.filter((pane) => pane.id !== paneId);
    return panes.length > 0 ? [{ ...column, panes }] : [];
  });
}

export function openScenePane(
  scene: Scene,
  target: ThreadRouteTarget,
  edge: SceneEdge,
  ids: SceneIds,
): Scene {
  const existing = findPaneByTarget(scene, target);
  if (existing !== null) return { ...focusScenePane(scene, existing.id), spotlightPaneId: null };
  const pane: ScenePane = { id: ids.paneId, target };
  const anchor = findScenePane(scene, scene.focusedPaneId) ?? scenePanes(scene).at(-1) ?? null;
  return {
    columns: placePane(scene.columns, pane, anchor?.id ?? null, edge, ids.columnId),
    focusedPaneId: pane.id,
    spotlightPaneId: null,
  };
}

export function moveScenePane(
  scene: Scene,
  paneId: string,
  anchorPaneId: string,
  zone: SceneDropZone,
  columnId: string,
): Scene {
  const pane = findScenePane(scene, paneId);
  const anchor = findScenePane(scene, anchorPaneId);
  if (pane === null || anchor === null || pane.id === anchor.id) return scene;
  if (zone === "center") {
    return {
      ...mapPanes(scene, (candidate) =>
        candidate.id === pane.id
          ? { ...candidate, target: anchor.target }
          : candidate.id === anchor.id
            ? { ...candidate, target: pane.target }
            : candidate,
      ),
      focusedPaneId: anchor.id,
      spotlightPaneId: null,
    };
  }
  return {
    columns: placePane(withoutPane(scene.columns, pane.id), pane, anchor.id, zone, columnId),
    focusedPaneId: pane.id,
    spotlightPaneId: null,
  };
}

export function dropSceneThread(
  scene: Scene,
  target: ThreadRouteTarget,
  anchorPaneId: string,
  zone: SceneDropZone,
  ids: SceneIds,
): Scene {
  const existing = findPaneByTarget(scene, target);
  if (existing !== null) {
    return existing.id === anchorPaneId
      ? { ...focusScenePane(scene, existing.id), spotlightPaneId: null }
      : moveScenePane(scene, existing.id, anchorPaneId, zone, ids.columnId);
  }
  if (findScenePane(scene, anchorPaneId) === null) return scene;
  if (zone === "center") {
    return {
      ...mapPanes(scene, (pane) => (pane.id === anchorPaneId ? { ...pane, target } : pane)),
      focusedPaneId: anchorPaneId,
      spotlightPaneId: null,
    };
  }
  const pane: ScenePane = { id: ids.paneId, target };
  return {
    columns: placePane(scene.columns, pane, anchorPaneId, zone, ids.columnId),
    focusedPaneId: pane.id,
    spotlightPaneId: null,
  };
}

export function sceneDropZone(
  rect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  point: { readonly x: number; readonly y: number },
): SceneDropZone {
  const x = (point.x - rect.left) / rect.width;
  const y = (point.y - rect.top) / rect.height;
  const [edge, distance] = (
    [
      ["left", x],
      ["right", 1 - x],
      ["top", y],
      ["bottom", 1 - y],
    ] as const
  ).reduce((nearest, candidate) => (candidate[1] < nearest[1] ? candidate : nearest));
  return distance < 0.25 ? edge : "center";
}

export function sceneThrowCommits(travelY: number, velocityY: number): boolean {
  return velocityY > 0.6 && travelY + velocityY * 180 > 240;
}

export function releasableScenePaneId(scene: Scene, targetKey: string): string | null {
  const panes = scenePanes(scene);
  if (panes.length < 2) return null;
  return panes.find((pane) => sceneTargetKey(pane.target) === targetKey)?.id ?? null;
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function visibleSceneTargetKeys(scene: Scene): ReadonlySet<string> {
  const spotlight = findScenePane(scene, scene.spotlightPaneId);
  const panes = spotlight === null ? scenePanes(scene) : [spotlight];
  return new Set(panes.map((pane) => sceneTargetKey(pane.target)));
}

export function splitSceneTargetKeys(scene: Scene): ReadonlySet<string> {
  const panes = scenePanes(scene);
  return panes.length < 2 ? NO_KEYS : new Set(panes.map((pane) => sceneTargetKey(pane.target)));
}

export function closeScenePane(scene: Scene, paneId: string): Scene {
  const panes = scenePanes(scene);
  const index = panes.findIndex((pane) => pane.id === paneId);
  if (index === -1) return scene;
  if (panes.length === 1) return EMPTY_SCENE;
  const columns = withoutPane(scene.columns, paneId);
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
