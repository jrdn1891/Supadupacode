// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vite-plus/test";

import { sceneDropTargetAt } from "./sceneDrag";

function stackedColumn() {
  document.body.innerHTML = `
    <div data-scene-column>
      <div data-scene-pane="upper"></div>
      <div data-scene-pane="lower"></div>
    </div>`;
  const column = document.querySelector("[data-scene-column]")!;
  const upper = document.querySelector("[data-scene-pane='upper']")!;
  column.getBoundingClientRect = () => new DOMRect(200, 0, 800, 600);
  upper.getBoundingClientRect = () => new DOMRect(200, 0, 800, 300);
  document.elementFromPoint = () => upper;
}

describe("sceneDropTargetAt", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("previews a side drop as the new column beside the pane's column", () => {
    stackedColumn();
    expect(sceneDropTargetAt({ x: 990, y: 150 })).toEqual({
      paneId: "upper",
      zone: "right",
      preview: { left: 600, top: 0, width: 400, height: 600 },
    });
  });

  it.each([
    ["top", { x: 600, y: 10 }, { left: 200, top: 0, width: 800, height: 150 }],
    ["bottom", { x: 600, y: 290 }, { left: 200, top: 150, width: 800, height: 150 }],
    ["center", { x: 600, y: 150 }, { left: 200, top: 0, width: 800, height: 300 }],
  ] as const)("previews a %s drop inside the pane", (zone, point, preview) => {
    stackedColumn();
    expect(sceneDropTargetAt(point)).toEqual({ paneId: "upper", zone, preview });
  });
});
