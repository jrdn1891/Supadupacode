import { describe, expect, it } from "vite-plus/test";

import { cueMark } from "./creatures.ts";

describe("cueMark", () => {
  it("draws the cue's glyph inside its speech bubble", () => {
    expect(cueMark("ready")).toEqual({
      rows: [
        ".bbbbbbbbb.",
        "bbbbbbbbbbb",
        "bbbbbbbbgbb",
        "bbbbbbbgbbb",
        "bbgbbbgbbbb",
        "bbbgbgbbbbb",
        "bbbbgbbbbbb",
        "bbbbbbbbbbb",
        ".bbbbbbbbb.",
        "....bbb....",
        ".....b.....",
      ],
      palette: { b: "#3fcf86", g: "#1a1206" },
    });
  });
});
