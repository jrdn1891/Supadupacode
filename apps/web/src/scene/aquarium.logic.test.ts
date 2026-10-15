import { describe, expect, it } from "vite-plus/test";

import {
  AQUARIUM_SAND,
  type Aquarium,
  type AquariumResident,
  createAquarium,
  fishSize,
  parkingSpot,
  stepAquarium,
  stockAquarium,
} from "./aquarium.logic";

const resident = (key: string, cue: AquariumResident["cue"] = "working"): AquariumResident => ({
  key,
  projectKey: "project",
  cue,
});

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const SIZE = { width: 200, height: 120, top: 40 };

function run(aquarium: Aquarium, ticks: number, featuredKey: string | null = null) {
  const random = seeded(7);
  let next = aquarium;
  for (let tick = 0; tick < ticks; tick++)
    next = stepAquarium(next, { featuredKey, heldKey: null, random });
  return next;
}

describe("stockAquarium", () => {
  it("keeps one fish per backstage agent and leaves settled fish where they swim", () => {
    const random = seeded(1);
    const tank = createAquarium(SIZE, [resident("a"), resident("b")], null, random);
    const restocked = stockAquarium(tank, [resident("b"), resident("c")], random);
    expect(restocked.fish.map((fish) => fish.key)).toEqual(["b", "c"]);
    expect(restocked.fish[0]).toBe(tank.fish[1]);
  });

  it("fills an empty tank in place and lets later agents swim in from the side", () => {
    const filled = stockAquarium(
      createAquarium(SIZE, [], null, seeded(2)),
      ["a", "b", "c"].map((key) => resident(key)),
      seeded(3),
    );
    for (const fish of filled.fish) {
      expect(fish.x).toBeGreaterThanOrEqual(0);
      expect(fish.x + fishSize(fish.key).width).toBeLessThanOrEqual(SIZE.width);
    }
    const arrival = stockAquarium(
      filled,
      ["a", "b", "c", "d"].map((key) => resident(key)),
      seeded(4),
    ).fish[3]!;
    expect(arrival.x <= -fishSize("d").width || arrival.x >= SIZE.width).toBe(true);
  });
});

describe("stepAquarium", () => {
  it("keeps every fish inside the swim band as it crosses and re-enters the tank", () => {
    const tank = run(
      createAquarium(
        SIZE,
        ["a", "b", "c"].map((key) => resident(key)),
        null,
        seeded(4),
      ),
      2_000,
    );
    for (const fish of tank.fish) {
      expect(fish.y).toBeGreaterThanOrEqual(SIZE.top);
      expect(fish.y + fishSize(fish.key).height).toBeLessThanOrEqual(SIZE.height - AQUARIUM_SAND);
    }
  });

  it("brings the fish of the agent that needs you under the caption and holds it there", () => {
    const residents = [resident("a"), resident("b", "approval")];
    const tank = run(createAquarium(SIZE, residents, null, seeded(5)), 400, "b");
    const parked = tank.fish.find((fish) => fish.key === "b")!;
    expect({ x: parked.x, y: parked.y }).toEqual(parkingSpot(tank, "b"));
    expect(run(tank, 30, "b").fish.find((fish) => fish.key === "b")).toEqual(parked);
  });
});
