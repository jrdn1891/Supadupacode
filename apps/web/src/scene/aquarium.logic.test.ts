import { describe, expect, it } from "vite-plus/test";

import {
  AQUARIUM_FPS,
  AQUARIUM_SAND,
  type Aquarium,
  type AquariumFish,
  type AquariumResident,
  createAquarium,
  creditStash,
  dropPearls,
  finishedResidents,
  fishSize,
  fishTraits,
  FRESH_STASH,
  HATCH_MS,
  landingSpot,
  leapKeyframes,
  parkingSpot,
  type PetKind,
  PETS,
  releasePrey,
  type Species,
  SPECIES,
  stepAquarium,
  stirAquarium,
  stockAquarium,
  tapAquarium,
} from "./aquarium.logic";

const resident = (
  key: string,
  cue: AquariumResident["cue"] = "working",
  items = 0,
): AquariumResident => ({ key, projectKey: "project", cue, items });

const KEYS = Array.from({ length: 40 }, (_, index) => `thread-${index}`);

const keyOf = (species: Species, nth = 0) =>
  KEYS.filter((key) => fishTraits(key).species === species)[nth]!;

const swimmer = (key: string, x: number, y: number, dir: 1 | -1 = 1): AquariumFish => ({
  key,
  x,
  y,
  dir,
  wait: 0,
  full: 0,
  drift: { x: 0, y: 0 },
});

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const SIZE = { width: 200, height: 120, top: 40 };
const SEABED = SIZE.height - AQUARIUM_SAND - 1;

function run(
  aquarium: Aquarium,
  ticks: number,
  featuredKey: string | null = null,
  heldKey: string | null = null,
) {
  const random = seeded(7);
  let next = aquarium;
  for (let tick = 0; tick < ticks; tick++)
    next = stepAquarium(next, { featuredKey, heldKey, vents: [], random });
  return next;
}

const tankOf = (
  fish: ReadonlyArray<AquariumFish>,
  pellets: Aquarium["pellets"] = [],
): Aquarium => ({ ...createAquarium(SIZE, [], null, seeded(1)), fish, pellets });

describe("stockAquarium", () => {
  it("keeps one fish per agent and leaves settled fish where they swim", () => {
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
  it("keeps every species inside the swim band as it crosses and re-enters the tank", () => {
    expect(new Set(KEYS.map((key) => fishTraits(key).species))).toEqual(
      new Set(Object.keys(SPECIES)),
    );
    const tank = run(
      createAquarium(
        SIZE,
        KEYS.map((key) => resident(key)),
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

  it("keeps a held fish still even while it is on its way under the caption", () => {
    const key = keyOf("fish");
    const tank = tankOf([swimmer(key, 20, 80)]);
    expect(run(tank, 30, key, key).fish[0]).toEqual(tank.fish[0]);
  });

  it("sinks a starfish that is no longer featured back to the floor", () => {
    const key = keyOf("starfish");
    const climbed = run(createAquarium(SIZE, [resident(key, "ready")], key, seeded(6)), 10, key);
    expect(climbed.fish[0]!.y).toBe(SIZE.top);
    expect(run(climbed, 100).fish[0]!.y).toBe(
      SIZE.height - AQUARIUM_SAND - 2 - fishSize(key).height,
    );
  });
});

describe("feeding", () => {
  it("sinks a pellet onto the sand, rests it there for half a minute, then dissolves it", () => {
    const { aquarium, stash } = tapAquarium(tankOf([]), FRESH_STASH, { x: 100, y: 60 }, 0);
    expect(stash.food).toBe(FRESH_STASH.food - 1);
    const sinking = run(aquarium, 50).pellets[0]!;
    expect(sinking.y).toBeGreaterThan(60);
    expect(sinking.y).toBeLessThan(SEABED);
    const landed = run(aquarium, 15 * AQUARIUM_FPS);
    expect(landed.pellets[0]?.y).toBe(SEABED);
    expect(run(landed, 25 * AQUARIUM_FPS).pellets).toHaveLength(1);
    expect(run(landed, 32 * AQUARIUM_FPS).pellets).toEqual([]);
  });

  it("feeds the nearest free creature while parked and held creatures ignore food", () => {
    const [near, far] = [keyOf("fish", 0), keyOf("fish", 1)];
    const fed = run(
      tankOf([swimmer(near, 80, 56), swimmer(far, 130, 56, -1)], [{ x: 100, y: 60, rest: 0 }]),
      30,
    );
    expect(fed.pellets).toEqual([]);
    expect(fed.fish.map((fish) => fish.full > 0)).toEqual([true, false]);

    const ignored = run(
      tankOf(
        [swimmer(near, 80, 56), swimmer(far, 120, 56)],
        [
          { x: 86, y: 58, rest: 0 },
          { x: 126, y: 58, rest: 0 },
        ],
      ),
      5,
      near,
      far,
    );
    expect(ignored.fish.map((fish) => fish.full)).toEqual([0, 0]);
    expect(ignored.pellets).toHaveLength(2);
  });

  it("never steers a seahorse, which only snaps up pellets passing its snout", () => {
    const key = keyOf("seahorse");
    const passed = run(tankOf([swimmer(key, 100, 60)], [{ x: 90, y: 75, rest: 0 }]), 20).fish[0]!;
    expect(passed).toMatchObject({ y: 60, full: 0 });
    expect(passed.x).toBeCloseTo(100 + 20 * fishTraits(key).speed);
    const snapped = run(tankOf([swimmer(key, 100, 60)], [{ x: 108, y: 56, rest: 0 }]), 15);
    expect(snapped.fish[0]!.full).toBeGreaterThan(0);
  });

  it("lets a turtle ignore sinking pellets and graze the ones resting on the sand", () => {
    const key = keyOf("turtle");
    const sinking = run(tankOf([swimmer(key, 100, 90)], [{ x: 110, y: 92, rest: 0 }]), 3);
    expect(sinking.fish[0]!.full).toBe(0);
    expect(sinking.pellets).toHaveLength(1);
    const resting = run(tankOf([swimmer(key, 100, 90)], [{ x: 125, y: SEABED, rest: 0 }]), 150);
    expect(resting.fish[0]!.full).toBeGreaterThan(0);
    expect(resting.pellets).toEqual([]);
  });

  it("earns a pellet for every four new items and a bonus when an agent finishes, up to nine", () => {
    const before = [resident("a", "working", 10), resident("b")];
    const credit = (after: ReadonlyArray<AquariumResident>) =>
      creditStash(FRESH_STASH, before, after).food - FRESH_STASH.food;
    expect(credit([resident("a", "working", 18), resident("b")])).toBe(2);
    expect(credit([resident("a", "ready", 10), resident("b")])).toBe(3);
    expect(credit([resident("a"), resident("b"), resident("c", "working", 40)])).toBe(0);
    expect(creditStash(FRESH_STASH, before, [resident("a", "working", 400)]).food).toBe(9);
  });

  it("drops nothing from an empty feeder and ripples the water instead", () => {
    const empty = { food: 0.75, strand: [] };
    const { aquarium, stash } = tapAquarium(tankOf([]), empty, { x: 50, y: 50 }, 0);
    expect(aquarium.pellets).toEqual([]);
    expect(aquarium.ripple).not.toBeNull();
    expect(stash).toBe(empty);
  });
});

describe("pearls", () => {
  it("drops a pearl to the sand when an agent finishes and strings it when tapped", () => {
    const before = [resident("a")];
    const after = [{ ...resident("a", "ready"), projectKey: "blue" }];
    const tank = createAquarium(SIZE, before, null, seeded(3));
    const [finisher] = tank.fish;
    const [pearl] = run(dropPearls(tank, finishedResidents(before, after)), 120).pearls;
    expect(pearl).toMatchObject({ y: SEABED, projectKey: "blue" });
    expect(Math.abs(pearl!.x + 1 - (finisher!.x + fishSize("a").width / 2))).toBeLessThanOrEqual(1);
    const { aquarium, stash } = tapAquarium(
      { ...tank, pearls: [pearl!] },
      FRESH_STASH,
      { x: pearl!.x + 1, y: pearl!.y + 1 },
      0,
    );
    expect(aquarium.pearls).toEqual([]);
    expect(aquarium.pellets).toEqual([]);
    expect(stash).toEqual({ food: FRESH_STASH.food, strand: ["blue"] });
  });
});

describe("stirAquarium", () => {
  it("sweeps nearby creatures along the drag until the current dies down", () => {
    const [swept, parked, star] = [keyOf("fish"), keyOf("angelfish"), keyOf("starfish")];
    const tank = tankOf([
      swimmer(swept, 90, 60, -1),
      swimmer(parked, 95, 60),
      swimmer(star, 88, 60),
    ]);
    const stirred = stirAquarium(tank, {
      from: { x: 90, y: 64 },
      to: { x: 96, y: 64 },
      residents: [resident(swept), resident(parked), resident(star)],
      featuredKey: parked,
      heldKey: null,
    });
    expect(stirred.fish.slice(1)).toEqual(tank.fish.slice(1));
    const pushed = run(stirred, 5, parked);
    expect(pushed.fish[0]!.x).toBeGreaterThan(90);
    const calm = run(pushed, 3 * AQUARIUM_FPS, parked);
    expect(calm.fish[0]!.drift).toEqual({ x: 0, y: 0 });
    expect(run(calm, 1, parked).fish[0]!.x).toBeCloseTo(calm.fish[0]!.x - fishTraits(swept).speed);
  });

  it("schools stirred creatures of one project that swim close together", () => {
    const [first, second, stranger] = [keyOf("fish", 0), keyOf("fish", 1), keyOf("fish", 2)];
    const stirred = stirAquarium(
      tankOf([
        swimmer(first, 80, 60, -1),
        swimmer(second, 92, 62, -1),
        swimmer(stranger, 86, 70, -1),
      ]),
      {
        from: { x: 70, y: 66 },
        to: { x: 86, y: 66 },
        residents: [
          resident(first),
          resident(second),
          { ...resident(stranger), projectKey: "other" },
        ],
        featuredKey: null,
        heldKey: null,
      },
    );
    const [lead, mate, loner] = stirred.fish;
    expect([lead!.dir, mate!.dir, loner!.dir]).toEqual([1, 1, -1]);
    expect(mate!.drift).toEqual(lead!.drift);
    expect(loner!.drift.x).toBeGreaterThan(0);
    expect(loner!.drift.x).toBeLessThan(lead!.drift.x);
  });
});

describe("your fish", () => {
  const sizeOf = (kind: PetKind) => ({
    width: PETS[kind].frames[0][0].length,
    height: PETS[kind].frames[0].length,
  });
  const clownfish = {
    kind: "clownfish" as const,
    x: 70,
    y: 60,
    dir: 1 as const,
    prey: null,
    sated: false,
  };
  const shark = { ...clownfish, kind: "shark" as const, x: 62, y: 59, goal: { x: 72, y: 64 } };

  it("hatches where you hold the water, swims where you steer it, and leaves when tapped", () => {
    const at = { x: 100, y: 60 };
    const { width, height } = sizeOf("clownfish");
    expect(tapAquarium(tankOf([]), FRESH_STASH, at, HATCH_MS - 1).aquarium.pet).toBeNull();
    const { aquarium, stash } = tapAquarium(tankOf([]), FRESH_STASH, at, HATCH_MS);
    expect(stash).toBe(FRESH_STASH);
    expect(aquarium.pellets).toEqual([]);
    expect(aquarium.pet).toMatchObject({
      kind: "clownfish",
      x: at.x - width / 2,
      y: at.y - height / 2,
    });

    const pet = run({ ...aquarium, pet: { ...aquarium.pet!, goal: { x: 900, y: -40 } } }, 100).pet!;
    expect(pet).toMatchObject({ x: SIZE.width - width, y: SIZE.top, dir: 1 });

    const center = { x: pet.x + width / 2, y: pet.y + height / 2 };
    const held = tapAquarium({ ...aquarium, pet }, FRESH_STASH, center, HATCH_MS);
    expect(held.aquarium.pet).toBeNull();
    expect(held.stash).toBe(FRESH_STASH);
  });

  it("swaps between clownfish and shark each time you hold the water again", () => {
    const hold = (aquarium: Aquarium, at: { x: number; y: number }) =>
      tapAquarium(aquarium, FRESH_STASH, at, HATCH_MS).aquarium;
    const shark = hold(hold(tankOf([]), { x: 40, y: 60 }), { x: 150, y: 80 });
    const { width, height } = sizeOf("shark");
    expect(shark.pet).toMatchObject({
      kind: "shark",
      x: 150 - width / 2,
      y: 80 - height / 2,
      dir: -1,
    });
    expect(hold(shark, { x: 40, y: 60 }).pet).toMatchObject({ kind: "clownfish", dir: 1 });
  });

  it("scares swimmers away from its mouth while crawlers keep to the sand", () => {
    const [prey, star] = [keyOf("fish"), keyOf("starfish")];
    const sand = SIZE.height - AQUARIUM_SAND - 2 - fishSize(star).height;
    const pet = { ...clownfish, y: sand - 4, goal: { x: 76, y: sand } };
    const [fled, crawled] = run(
      { ...tankOf([swimmer(prey, 90, sand - 6, -1), swimmer(star, 84, sand, -1)]), pet },
      1,
    ).fish;
    expect(fled!.dir).toBe(1);
    expect(fled!.x).toBeGreaterThan(90);
    expect(crawled!).toMatchObject({ x: 84 - fishTraits(star).speed, y: sand, dir: -1 });
  });

  it("frightens creatures from farther away as a shark than as a clownfish", () => {
    const prey = swimmer(keyOf("fish"), 117, 60, -1);
    const [calm] = run(
      { ...tankOf([prey]), pet: { ...clownfish, goal: { x: 76, y: 64 } } },
      1,
    ).fish;
    const [scared] = run({ ...tankOf([prey]), pet: shark }, 1).fish;
    expect(calm!.dir).toBe(-1);
    expect(scared!.dir).toBe(1);
  });

  it("sends a caught creature out of the tank in a puff and spares a parked one", () => {
    const [prey, parked] = [keyOf("fish", 0), keyOf("fish", 1)];
    const pet = { ...clownfish, goal: { x: 76, y: 64 } };
    const after = run(
      { ...tankOf([swimmer(prey, 76, 60), swimmer(parked, 76, 60)]), pet },
      1,
      parked,
    );
    const [caught, spared] = after.fish;
    expect(caught!.x <= -fishSize(prey).width || caught!.x >= SIZE.width).toBe(true);
    expect(spared!.x).toBeGreaterThan(76);
    expect(after.bubbles).toContainEqual(expect.objectContaining({ y: 64, big: true }));
  });

  it("holds a creature it catches as a shark and bites again only once its jaws are clear", () => {
    const [prey, mate] = [keyOf("fish", 0), keyOf("fish", 1)];
    const caught = run(
      { ...tankOf([swimmer(prey, 76, 60), swimmer(mate, 76, 60)]), pet: shark },
      1,
    );
    expect(caught.pet).toMatchObject({ prey, sated: false });
    expect(caught.fish[1]!.x).toBeGreaterThan(76);
    expect(caught.bubbles).not.toContainEqual(expect.objectContaining({ big: true }));

    const held = run(caught, 20);
    expect(held.fish[0]).toEqual(caught.fish[0]);
    expect(held.pet!.prey).toBe(prey);
    const steered = { ...caught, pet: { ...caught.pet!, goal: { x: 0, y: 0 } } };
    expect(run(steered, 5).pet).toMatchObject({ prey, x: shark.x, y: shark.y });
    expect(run({ ...held, fish: [held.fish[1]!] }, 1).pet!.prey).toBeNull();

    const released = releasePrey(held);
    expect(released.pet).toMatchObject({ prey: null, sated: true });
    const escaping = run(released, 1);
    expect(escaping.pet).toMatchObject({ prey: null, sated: true });
    expect(escaping.fish[0]!.x).toBeGreaterThan(held.fish[0]!.x);
    expect(run(released, 30).pet).toMatchObject({ prey: null, sated: false });
  });

  it("lets a shark catch only creatures inside the tank", () => {
    const edge = { ...shark, x: 0, dir: -1 as const, goal: { x: 10, y: 64 } };
    const after = run({ ...tankOf([swimmer(keyOf("fish"), -8, 60)]), pet: edge }, 1);
    expect(after.pet!.prey).toBeNull();
  });
});

describe("landingSpot", () => {
  it("lands a released fish under the caption, leaping toward the middle of the tank", () => {
    const { width } = fishSize("a");
    const right = landingSpot(SIZE, "a", 170);
    expect(right).toMatchObject({ y: SIZE.top, dir: -1 });
    expect(right.x).toBeLessThan(170 - width / 2);
    expect(landingSpot(SIZE, "a", 30)).toMatchObject({ dir: 1 });
    for (const from of [-50, 0, SIZE.width, SIZE.width + 50]) {
      const { x } = landingSpot(SIZE, "a", from);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(SIZE.width);
    }
  });
});

describe("leapKeyframes", () => {
  it("leaves the send button unseen and lands level and full size where the tank takes over", () => {
    const frames = leapKeyframes({ x: 300, y: 600 }, { x: 250, y: 100 }, -1);
    expect(frames[0]).toMatchObject({ opacity: 0 });
    expect(frames[0]!.transform).toMatch(/^translate\(300px, 600px\) rotate\(60deg\)/);
    expect(frames.at(-1)).toEqual({
      transform: "translate(250px, 100px) rotate(0deg) scale(1)",
      opacity: 1,
    });
  });
});
