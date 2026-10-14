import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@supacode/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ThreadRouteTarget } from "../threadRoutes";
import {
  adjacentScenePaneId,
  closeScenePane,
  EMPTY_SCENE,
  focusScenePane,
  openScenePane,
  retargetScenePane,
  type Scene,
  scenePanes,
  syncSceneRoute,
  toggleSceneSpotlight,
} from "./scene.logic";

const thread = (id: string): ThreadRouteTarget => ({
  kind: "server",
  threadRef: scopeThreadRef("env" as EnvironmentId, ThreadId.make(id)),
});
const ids = (n: number) => ({ paneId: `pane-${n}`, columnId: `column-${n}` });
const layout = (scene: Scene) =>
  scene.columns.map((column) =>
    column.panes.map((pane) =>
      pane.target.kind === "server" ? pane.target.threadRef.threadId : pane.target.draftId,
    ),
  );

function stageOf(...threads: string[]): Scene {
  let scene = syncSceneRoute(EMPTY_SCENE, thread(threads[0]!), ids(0));
  threads.slice(1).forEach((id, index) => {
    scene = openScenePane(scene, thread(id), "right", ids(index + 1));
  });
  return scene;
}

describe("syncSceneRoute", () => {
  it("starts the stage with the routed thread", () => {
    const scene = syncSceneRoute(EMPTY_SCENE, thread("a"), ids(0));
    expect(layout(scene)).toEqual([["a"]]);
    expect(scene.focusedPaneId).toBe("pane-0");
  });

  it("shows a new route in the focused pane and keeps the pane", () => {
    const scene = syncSceneRoute(stageOf("a", "b"), thread("c"), ids(9));
    expect(layout(scene)).toEqual([["a"], ["c"]]);
    expect(scene.focusedPaneId).toBe("pane-1");
  });

  it("focuses the pane already showing the routed thread", () => {
    const scene = syncSceneRoute(stageOf("a", "b"), thread("a"), ids(9));
    expect(layout(scene)).toEqual([["a"], ["b"]]);
    expect(scene.focusedPaneId).toBe("pane-0");
  });
});

describe("openScenePane", () => {
  it("opens beside the focused column, or below the focused pane", () => {
    const beside = openScenePane(stageOf("a", "b"), thread("c"), "right", ids(9));
    expect(layout(beside)).toEqual([["a"], ["b"], ["c"]]);
    const below = openScenePane(stageOf("a", "b"), thread("c"), "below", ids(9));
    expect(layout(below)).toEqual([["a"], ["b", "c"]]);
    expect(below.focusedPaneId).toBe("pane-9");
  });

  it("keeps adding panes for as long as the user opens threads", () => {
    const names = Array.from({ length: 7 }, (_, index) => `t${index}`);
    expect(layout(stageOf(...names))).toEqual(names.map((name) => [name]));
  });

  it("focuses a thread that is already on stage instead of showing it twice", () => {
    const scene = openScenePane(stageOf("a", "b"), thread("a"), "right", ids(9));
    expect(layout(scene)).toEqual([["a"], ["b"]]);
    expect(scene.focusedPaneId).toBe("pane-0");
  });
});

describe("closeScenePane", () => {
  it("moves focus to the previous pane and drops empty columns", () => {
    const scene = closeScenePane(stageOf("a", "b", "c"), "pane-2");
    expect(layout(scene)).toEqual([["a"], ["b"]]);
    expect(scene.focusedPaneId).toBe("pane-1");
  });

  it("keeps the last pane", () => {
    const single = stageOf("a");
    expect(closeScenePane(single, "pane-0")).toBe(single);
  });

  it("leaves Spotlight when its pane closes", () => {
    const spotlit = toggleSceneSpotlight(stageOf("a", "b"), "pane-1");
    expect(closeScenePane(spotlit, "pane-1").spotlightPaneId).toBeNull();
  });
});

describe("retargetScenePane", () => {
  it("swaps a pane's thread, or closes it when that thread is already on stage", () => {
    expect(layout(retargetScenePane(stageOf("a", "b"), "pane-1", thread("c")))).toEqual([
      ["a"],
      ["c"],
    ]);
    expect(layout(retargetScenePane(stageOf("a", "b"), "pane-1", thread("a")))).toEqual([["a"]]);
  });
});

describe("toggleSceneSpotlight", () => {
  it("spotlights and focuses a pane, then returns to the same layout", () => {
    const scene = stageOf("a", "b");
    const spotlit = toggleSceneSpotlight(scene, "pane-0");
    expect(spotlit.spotlightPaneId).toBe("pane-0");
    expect(spotlit.focusedPaneId).toBe("pane-0");
    expect(toggleSceneSpotlight(spotlit, "pane-0").columns).toBe(spotlit.columns);
    expect(toggleSceneSpotlight(spotlit, "pane-0").spotlightPaneId).toBeNull();
  });
});

describe("focusScenePane", () => {
  it("keeps the scene when the pane already has focus", () => {
    const scene = stageOf("a", "b");
    expect(focusScenePane(scene, "pane-1")).toBe(scene);
  });

  it("carries Spotlight to the newly focused pane", () => {
    const spotlit = toggleSceneSpotlight(stageOf("a", "b"), "pane-1");
    expect(focusScenePane(spotlit, "pane-0").spotlightPaneId).toBe("pane-0");
  });
});

describe("adjacentScenePaneId", () => {
  it("walks panes in reading order and wraps", () => {
    const scene = openScenePane(stageOf("a", "b"), thread("c"), "below", ids(9));
    expect(scenePanes(scene).map((pane) => pane.id)).toEqual(["pane-0", "pane-1", "pane-9"]);
    expect(adjacentScenePaneId(scene, 1)).toBe("pane-0");
    expect(adjacentScenePaneId(scene, -1)).toBe("pane-1");
    expect(adjacentScenePaneId(stageOf("a"), 1)).toBeNull();
  });
});
