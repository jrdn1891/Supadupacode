import { type Contribution, ProjectId } from "@supacode/contracts";
import { describe, expect, it } from "vite-plus/test";

import { seabedDay, seabedPlants, seabedTally } from "./aquariumSeabed";

const contribution = (kind: Contribution["kind"], key: string): Contribution => ({
  kind,
  key,
  at: "2026-10-15T12:00:00.000Z",
  projectId: ProjectId.make("project"),
});

const commits = Array.from({ length: 30 }, (_, index) => contribution("commit", `commit-${index}`));

describe("seabedPlants", () => {
  it("grows seaweed for commits and coral for pull requests, corals in front", () => {
    const plants = seabedPlants(200, [
      contribution("pullRequest", "https://example.com/pr/1"),
      ...commits.slice(0, 3),
    ]);
    expect(plants.map((plant) => plant.kind)).toEqual(["weed", "weed", "weed", "coral"]);
  });

  it("plants within the tank and leaves earlier growth in place as more arrives", () => {
    const before = seabedPlants(200, commits.slice(0, 10));
    const after = seabedPlants(200, commits);
    for (const plant of after) {
      expect(plant.x).toBeGreaterThanOrEqual(0);
      expect(plant.x).toBeLessThanOrEqual(200);
    }
    for (const plant of before)
      expect(after.find((grown) => grown.key === plant.key)).toEqual(plant);
  });
});

describe("seabedDay", () => {
  it("spans the viewed day from local midnight to the next", () => {
    const { since, until } = seabedDay(new Date(2026, 9, 15, 10, 30).getTime(), 1);
    expect(new Date(since)).toEqual(new Date(2026, 9, 14));
    expect(new Date(until)).toEqual(new Date(2026, 9, 15));
  });
});

describe("seabedTally", () => {
  it("counts what grew", () => {
    expect(
      seabedTally([...commits.slice(0, 3), contribution("pullRequest", "https://example.com/1")]),
    ).toBe("3 commits · 1 pull request");
    expect(seabedTally([])).toBe("");
  });
});
