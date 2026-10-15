import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  buildDraftThreadRouteParams,
  buildThreadRouteParams,
  type ThreadRouteTarget,
} from "../threadRoutes";
import {
  adjacentScenePaneId,
  findScenePane,
  type SceneDropZone,
  type SceneEdge,
  scenePanes,
} from "./scene.logic";
import { useSceneStore } from "./sceneStore";

export function useSceneActions() {
  const navigate = useNavigate();
  return useMemo(() => {
    const show = (target: ThreadRouteTarget, replace: boolean) =>
      target.kind === "server"
        ? navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(target.threadRef),
            replace,
          })
        : navigate({
            to: "/draft/$draftId",
            params: buildDraftThreadRouteParams(target.draftId),
            replace,
          });
    const showFocused = (replace = true) => {
      const { scene } = useSceneStore.getState();
      const pane = findScenePane(scene, scene.focusedPaneId);
      if (pane !== null) void show(pane.target, replace);
    };
    const focus = (paneId: string) => {
      const store = useSceneStore.getState();
      if (store.scene.focusedPaneId === paneId) return;
      store.focus(paneId);
      showFocused();
    };
    const close = (paneId: string) => useSceneStore.getState().close(paneId);
    const toggleSpotlight = (paneId: string) => {
      const store = useSceneStore.getState();
      const refocus = store.scene.focusedPaneId !== paneId;
      store.toggleSpotlight(paneId);
      if (refocus) showFocused();
    };
    const withFocusedPane = (run: (paneId: string) => void) => () => {
      const { focusedPaneId } = useSceneStore.getState().scene;
      if (focusedPaneId !== null) run(focusedPaneId);
    };
    return {
      showFocused: () => showFocused(),
      focus,
      close,
      closeFocused: withFocusedPane(close),
      toggleSpotlight,
      toggleFocusedSpotlight: withFocusedPane(toggleSpotlight),
      focusAdjacent: (direction: 1 | -1) => {
        const paneId = adjacentScenePaneId(useSceneStore.getState().scene, direction);
        if (paneId !== null) focus(paneId);
      },
      open: (target: ThreadRouteTarget, edge: SceneEdge) => {
        useSceneStore.getState().open(target, edge);
        void show(target, false);
      },
      dropAll: (
        targets: ReadonlyArray<ThreadRouteTarget>,
        anchorPaneId: string,
        zone: SceneDropZone,
      ) => {
        let anchor = anchorPaneId;
        let placement = zone;
        for (const target of targets) {
          const store = useSceneStore.getState();
          store.drop(target, anchor, placement);
          const dropped = useSceneStore.getState().scene.focusedPaneId;
          if (dropped !== null && placement !== "left" && placement !== "top") anchor = dropped;
          if (placement === "center") placement = "right";
        }
        showFocused(false);
      },
      move: (paneId: string, anchorPaneId: string, zone: SceneDropZone) => {
        useSceneStore.getState().move(paneId, anchorPaneId, zone);
        showFocused();
      },
      leave: (paneId: string, target: ThreadRouteTarget | null) => {
        const store = useSceneStore.getState();
        const focused = store.scene.focusedPaneId === paneId;
        if (target !== null) {
          store.retarget(paneId, target);
          if (focused) void show(target, true);
          return;
        }
        if (scenePanes(store.scene).length > 1) close(paneId);
        else void navigate({ to: "/", replace: true });
      },
    };
  }, [navigate]);
}
