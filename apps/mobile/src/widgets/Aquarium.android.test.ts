import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@expo/ui/jetpack-compose", () => ({
  Box: "Box",
  Button: "Button",
  Column: "Column",
  Row: "Row",
  Text: "Text",
}));

vi.mock("@expo/ui/jetpack-compose/modifiers", () => ({
  background: (color: string) => ({ background: color }),
  fillMaxSize: () => "fillMaxSize",
  fillMaxWidth: () => "fillMaxWidth",
  padding: (...values: number[]) => ({ padding: values }),
  paddingAll: (value: number) => ({ paddingAll: value }),
  size: (width: number, height: number) => ({ size: [width, height] }),
}));

vi.mock("expo-widgets", () => ({
  createWidget: vi.fn((name: string, layout: unknown) => ({ layout, name })),
}));

import { SPECIES } from "@supacode/client-runtime/aquarium/creatures";
import type { ReactElement } from "react";

import { Aquarium } from "./Aquarium.android";
import { spriteRuns } from "../features/aquarium/sprites";

interface Node {
  readonly type: unknown;
  readonly props: { readonly children?: unknown };
}

function widestContainer(node: unknown): number {
  if (Array.isArray(node)) return Math.max(0, ...node.map(widestContainer));
  if (node === null || typeof node !== "object" || !("props" in node)) return 0;
  const children = (node as Node).props.children;
  const own = Array.isArray(children) ? children.flat().filter(Boolean).length : 0;
  return Math.max(own, widestContainer(children));
}

describe("Aquarium (Android)", () => {
  const tallest = Object.values(SPECIES)
    .map((species) => species.frames[0])
    .reduce((left, right) => (right.length > left.length ? right : left));
  const body = spriteRuns(tallest, { x: "#111111", o: "#222222", f: "#333333", e: "#000000" });
  const tree = Aquarium({
    url: "supacode://",
    caption: "Ship it · Needs approval",
    working: 2,
    needsYou: 1,
    updatedAt: Date.parse("2026-10-15T12:00:00.000Z"),
    fish: Array.from({ length: 6 }, (_, index) => ({
      key: `fish-${index}`,
      body,
      mark: null,
      lift: index % 3,
    })),
  }) as ReactElement;

  it("shows the counts and the caption", () => {
    const json = JSON.stringify(tree);
    expect(json).toContain("2 working · 1 needs you");
    expect(json).toContain("Ship it · Needs approval");
  });

  it("keeps every row and column within Glance's ten-child limit", () => {
    expect(tallest.length).toBeGreaterThan(10);
    expect(widestContainer(tree)).toBeLessThanOrEqual(10);
  });
});
