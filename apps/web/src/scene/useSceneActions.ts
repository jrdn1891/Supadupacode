import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  buildDraftThreadRouteParams,
  buildThreadRouteParams,
  type ThreadRouteTarget,
} from "../threadRoutes";
import { adjacentScenePaneId, findScenePane, type ScenePlacement, scenePanes } from "./scene.logic";
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
    const showFocused = () => {
      const { scene } = useSceneStore.getState();
      const pane = findScenePane(scene, scene.focusedPaneId);
      if (pane !== null) void show(pane.target, true);
    };
    const focus = (paneId: string) => {
      const store = useSceneStore.getState();
      if (store.scene.focusedPaneId === paneId) return;
      store.focus(paneId);
      showFocused();
    };
    const close = (paneId: string) => {
      const store = useSceneStore.getState();
      const wasFocused = store.scene.focusedPaneId === paneId;
      store.close(paneId);
      if (wasFocused) showFocused();
    };
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
      focus,
      close,
      closeFocused: withFocusedPane(close),
      toggleSpotlight,
      toggleFocusedSpotlight: withFocusedPane(toggleSpotlight),
      focusAdjacent: (direction: 1 | -1) => {
        const paneId = adjacentScenePaneId(useSceneStore.getState().scene, direction);
        if (paneId !== null) focus(paneId);
      },
      open: (target: ThreadRouteTarget, placement: ScenePlacement) => {
        useSceneStore.getState().open(target, placement);
        void show(target, false);
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
