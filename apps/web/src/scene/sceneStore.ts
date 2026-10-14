import { ScopedThreadRef } from "@supacode/contracts";
import * as Schema from "effect/Schema";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../lib/storage";
import { randomUUID } from "../lib/utils";
import type { ThreadRouteTarget } from "../threadRoutes";
import {
  closeScenePane,
  dropSceneThread,
  EMPTY_SCENE,
  focusScenePane,
  moveScenePane,
  openScenePane,
  releasableScenePaneId,
  retargetScenePane,
  type Scene,
  type SceneDropZone,
  type SceneEdge,
  type ScenePane,
  syncSceneRoute,
  toggleSceneSpotlight,
} from "./scene.logic";

const SOLO_SCENE_IDS = { paneId: "pane-solo", columnId: "column-solo" } as const;

interface SceneStoreState {
  readonly scene: Scene;
  readonly syncRoute: (target: ThreadRouteTarget) => void;
  readonly open: (target: ThreadRouteTarget, edge: SceneEdge) => void;
  readonly drop: (target: ThreadRouteTarget, anchorPaneId: string, zone: SceneDropZone) => void;
  readonly move: (paneId: string, anchorPaneId: string, zone: SceneDropZone) => void;
  readonly close: (paneId: string) => void;
  readonly release: (targetKey: string) => void;
  readonly focus: (paneId: string) => void;
  readonly retarget: (paneId: string, target: ThreadRouteTarget) => void;
  readonly toggleSpotlight: (paneId: string) => void;
}

const freshIds = () => ({ paneId: randomUUID(), columnId: randomUUID() });

const isScopedThreadRef = Schema.is(ScopedThreadRef);

function isTarget(value: unknown): value is ThreadRouteTarget {
  const target = value as ThreadRouteTarget | null;
  if (target?.kind === "server") return isScopedThreadRef(target.threadRef);
  return target?.kind === "draft" && typeof target.draftId === "string";
}

function isScene(value: unknown): value is Scene {
  const scene = value as Scene | null;
  return (
    Array.isArray(scene?.columns) &&
    scene.columns.every(
      (column) =>
        typeof column?.id === "string" &&
        Array.isArray(column.panes) &&
        column.panes.length > 0 &&
        column.panes.every(
          (pane: ScenePane | null) => typeof pane?.id === "string" && isTarget(pane.target),
        ),
    )
  );
}

export const useSceneStore = create<SceneStoreState>()(
  persist(
    (set) => ({
      scene: EMPTY_SCENE,
      syncRoute: (target) =>
        set(({ scene }) => ({ scene: syncSceneRoute(scene, target, SOLO_SCENE_IDS) })),
      open: (target, edge) =>
        set(({ scene }) => ({ scene: openScenePane(scene, target, edge, freshIds()) })),
      drop: (target, anchorPaneId, zone) =>
        set(({ scene }) => ({
          scene: dropSceneThread(scene, target, anchorPaneId, zone, freshIds()),
        })),
      move: (paneId, anchorPaneId, zone) =>
        set(({ scene }) => ({
          scene: moveScenePane(scene, paneId, anchorPaneId, zone, randomUUID()),
        })),
      close: (paneId) => set(({ scene }) => ({ scene: closeScenePane(scene, paneId) })),
      release: (targetKey) =>
        set(({ scene }) => {
          const paneId = releasableScenePaneId(scene, targetKey);
          return { scene: paneId === null ? scene : closeScenePane(scene, paneId) };
        }),
      focus: (paneId) => set(({ scene }) => ({ scene: focusScenePane(scene, paneId) })),
      retarget: (paneId, target) =>
        set(({ scene }) => ({ scene: retargetScenePane(scene, paneId, target) })),
      toggleSpotlight: (paneId) =>
        set(({ scene }) => ({ scene: toggleSceneSpotlight(scene, paneId) })),
    }),
    {
      name: "supacode:scene:v1",
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      version: 1,
      partialize: ({ scene }) => ({ scene }),
      merge: (persisted, current) => {
        const scene = (persisted as Partial<Pick<SceneStoreState, "scene">> | null)?.scene;
        return isScene(scene) ? { ...current, scene } : current;
      },
    },
  ),
);
