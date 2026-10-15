import { describe, expect, it } from "vite-plus/test";

import { spriteRuns } from "./sprites";

describe("spriteRuns", () => {
  it("merges neighbouring pixels of one color and keeps gaps as clear runs", () => {
    expect(spriteRuns(["..xxo", "x.x"], { x: "#111", o: "#222" })).toEqual([
      {
        y: 0,
        runs: [
          { x: 0, span: 2, color: null },
          { x: 2, span: 2, color: "#111" },
          { x: 4, span: 1, color: "#222" },
        ],
      },
      {
        y: 1,
        runs: [
          { x: 0, span: 1, color: "#111" },
          { x: 1, span: 1, color: null },
          { x: 2, span: 1, color: "#111" },
        ],
      },
    ]);
  });
});
