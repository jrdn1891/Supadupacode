import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@supacode/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ThreadRouteTarget } from "../threadRoutes";
import {
  adjacentScenePaneId,
  closeScenePane,
  dropSceneThread,
  EMPTY_SCENE,
  focusScenePane,
  moveScenePane,
  openScenePane,
  releasableScenePaneId,
  retargetScenePane,
  type Scene,
  sceneDropZone,
  scenePanes,
  sceneTargetKey,
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
    const below = openScenePane(stageOf("a", "b"), thread("c"), "bottom", ids(9));
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

describe("dropSceneThread", () => {
  it("opens a dropped thread on the edge of the pane it landed on", () => {
    const scene = stageOf("a", "b");
    expect(layout(dropSceneThread(scene, thread("c"), "pane-1", "left", ids(9)))).toEqual([
      ["a"],
      ["c"],
      ["b"],
    ]);
    const above = dropSceneThread(scene, thread("c"), "pane-0", "top", ids(9));
    expect(layout(above)).toEqual([["c", "a"], ["b"]]);
    expect(above.focusedPaneId).toBe("pane-9");
  });

  it("shows a thread dropped in a pane's center in that pane", () => {
    const scene = dropSceneThread(stageOf("a", "b"), thread("c"), "pane-0", "center", ids(9));
    expect(layout(scene)).toEqual([["c"], ["b"]]);
    expect(scene.focusedPaneId).toBe("pane-0");
  });

  it("moves a thread that is already on stage instead of showing it twice", () => {
    const scene = dropSceneThread(stageOf("a", "b", "c"), thread("c"), "pane-0", "bottom", ids(9));
    expect(layout(scene)).toEqual([["a", "c"], ["b"]]);
  });
});

describe("moveScenePane", () => {
  it("re-docks a pane beside another and drops the column it left", () => {
    const scene = moveScenePane(stageOf("a", "b", "c"), "pane-0", "pane-2", "right", "column-9");
    expect(layout(scene)).toEqual([["b"], ["c"], ["a"]]);
    expect(scene.focusedPaneId).toBe("pane-0");
  });

  it("swaps threads when dropped on another pane's center", () => {
    const scene = moveScenePane(stageOf("a", "b"), "pane-0", "pane-1", "center", "column-9");
    expect(layout(scene)).toEqual([["b"], ["a"]]);
    expect(scene.focusedPaneId).toBe("pane-1");
  });

  it("ignores a drop on the pane itself", () => {
    const scene = stageOf("a", "b");
    expect(moveScenePane(scene, "pane-1", "pane-1", "left", "column-9")).toBe(scene);
  });
});

describe("sceneDropZone", () => {
  const rect = { left: 0, top: 0, width: 400, height: 200 };
  it("picks the nearest edge within a quarter of the pane, else the center", () => {
    expect(sceneDropZone(rect, { x: 20, y: 100 })).toBe("left");
    expect(sceneDropZone(rect, { x: 390, y: 100 })).toBe("right");
    expect(sceneDropZone(rect, { x: 200, y: 10 })).toBe("top");
    expect(sceneDropZone(rect, { x: 200, y: 190 })).toBe("bottom");
    expect(sceneDropZone(rect, { x: 200, y: 100 })).toBe("center");
  });
});

describe("releasableScenePaneId", () => {
  it("releases a thread's pane only while other panes stay on stage", () => {
    const key = (id: string) => sceneTargetKey(thread(id));
    expect(releasableScenePaneId(stageOf("a", "b"), key("b"))).toBe("pane-1");
    expect(releasableScenePaneId(stageOf("a"), key("a"))).toBeNull();
    expect(releasableScenePaneId(stageOf("a", "b"), key("c"))).toBeNull();
  });
});

describe("closeScenePane", () => {
  it("moves focus to the previous pane and drops empty columns", () => {
    const scene = closeScenePane(stageOf("a", "b", "c"), "pane-2");
    expect(layout(scene)).toEqual([["a"], ["b"]]);
    expect(scene.focusedPaneId).toBe("pane-1");
  });

  it("clears the stage when the last pane closes", () => {
    expect(closeScenePane(stageOf("a"), "pane-0")).toEqual(EMPTY_SCENE);
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
    const scene = openScenePane(stageOf("a", "b"), thread("c"), "bottom", ids(9));
    expect(scenePanes(scene).map((pane) => pane.id)).toEqual(["pane-0", "pane-1", "pane-9"]);
    expect(adjacentScenePaneId(scene, 1)).toBe("pane-0");
    expect(adjacentScenePaneId(scene, -1)).toBe("pane-1");
    expect(adjacentScenePaneId(stageOf("a"), 1)).toBeNull();
  });
});
