import { describe, expect, it } from "vite-plus/test";

import { recordPaths } from "./svgPen";

describe("recordPaths", () => {
  it("joins a row's neighboring pixels into one run", () => {
    const paths = recordPaths((pen) => {
      pen.fill("#111", 0, 0, 1, 1);
      pen.fill("#111", 1, 0, 1, 1);
      pen.fill("#111", 2, 0, 1, 1);
    });
    expect(paths).toEqual([{ key: "#111@1#0", color: "#111", opacity: 1, d: "M0 0h3v1H0z" }]);
  });

  it("keeps one path per color when a sprite's colors interleave without overlapping", () => {
    const paths = recordPaths((pen) => {
      pen.fill("#111", 0, 0, 1, 1);
      pen.fill("#222", 1, 0, 1, 1);
      pen.fill("#111", 2, 0, 1, 1);
    });
    expect(paths).toEqual([
      { key: "#111@1#0", color: "#111", opacity: 1, d: "M0 0h1v1H0zM2 0h1v1H2z" },
      { key: "#222@1#0", color: "#222", opacity: 1, d: "M1 0h1v1H1z" },
    ]);
  });

  it("paints a fill that a later color covers in a new path above it", () => {
    const paths = recordPaths((pen) => {
      pen.fill("#111", 0, 0, 1, 1);
      pen.fill("#222", 4, 0, 4, 4);
      pen.fill("#111", 5, 1, 1, 1);
    });
    expect(paths.map((path) => path.key)).toEqual(["#111@1#0", "#222@1#0", "#111@1#1"]);
  });

  it("rounds translucency to a few steps and skips what rounds to clear", () => {
    const paths = recordPaths((pen) => {
      pen.alpha(0.72);
      pen.fill("#111", 0, 0, 1, 1);
      pen.alpha(0.01);
      pen.fill("#111", 1, 0, 1, 1);
    });
    expect(paths).toEqual([
      { key: "#111@0.71875#0", color: "#111", opacity: 0.71875, d: "M0 0h1v1H0z" },
    ]);
  });
});
