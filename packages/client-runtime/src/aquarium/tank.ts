// @effect-diagnostics globalTimers:off - The tank animates in the client, outside an Effect runtime.
import type { AquariumAgent } from "./agents.ts";
import { fishBob } from "./paint.ts";
import { takeRelease } from "./releases.ts";
import type { AquariumPlant } from "./seabed.ts";
import {
  AQUARIUM_FPS,
  type Aquarium,
  type AquariumFish,
  type AquariumPoint,
  type AquariumResident,
  type AquariumSize,
  type AquariumStash,
  createAquarium,
  creditStash,
  dropPearls,
  finishedResidents,
  fishSize,
  FRESH_STASH,
  releasePrey,
  resizeAquarium,
  sharkAt,
  stepAquarium,
  stirAquarium,
  stockAquarium,
  tapAquarium,
} from "./simulation.ts";

interface AquariumSeabed {
  readonly since: string;
  readonly plants: ReadonlyArray<AquariumPlant>;
}

export interface TankInput {
  readonly size: AquariumSize | null;
  readonly residents: ReadonlyArray<AquariumResident>;
  readonly featuredKey: string | null;
  readonly reducedMotion: boolean;
  readonly seabed: AquariumSeabed | null;
}

export interface TankFrame {
  readonly aquarium: Aquarium;
  readonly residents: ReadonlyMap<string, AquariumResident>;
  readonly tick: number;
  readonly stash: AquariumStash | null;
  readonly plants: ReadonlyArray<AquariumPlant>;
  readonly sprouts: ReadonlyMap<string, number>;
}

export interface TankLeap {
  readonly spot: AquariumFish;
  readonly landed: Promise<unknown>;
  readonly cancel: () => void;
}

let stash = FRESH_STASH;
let seen: ReadonlyArray<AquariumResident> = [];
let resting: { readonly aquarium: Aquarium; readonly tick: number } | null = null;

export function tankResidents(agents: ReadonlyArray<AquariumAgent>) {
  return agents.map((agent): AquariumResident => ({
    key: agent.key,
    projectKey: agent.thread.projectId,
    cue: agent.cue,
    items: agent.thread.itemCount,
  }));
}

const castOf = (residents: ReadonlyArray<AquariumResident>) =>
  residents.map((resident) => `${resident.key}:${resident.cue}`).join("|");

export function startTank(options: {
  readonly paint: (frame: TankFrame) => void;
  readonly hidden: () => boolean;
  readonly leap: (
    resident: AquariumResident,
    from: AquariumPoint,
    size: AquariumSize,
    tick: number,
  ) => TankLeap;
  readonly onPrey?: (fish: AquariumFish | null) => void;
}) {
  let input: TankInput | null = null;
  let aquarium: Aquarium | null = null;
  let held: string | null = null;
  let pinned: string | null = null;
  let prey: string | null = null;
  let lure: AquariumPoint | null = null;
  let tick = resting?.tick ?? 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let vents: ReadonlyArray<number> = [];
  const leaps = new Map<string, TankLeap>();
  const sprouts = new Map<string, number>();

  const paint = () => {
    if (input === null || aquarium === null) return;
    options.paint({
      aquarium,
      residents: new Map(input.residents.map((resident) => [resident.key, resident])),
      tick,
      stash: input.reducedMotion ? null : stash,
      plants: input.seabed?.plants ?? [],
      sprouts,
    });
  };

  const notice = () => {
    const next = aquarium?.shark.prey ?? null;
    if (next === prey) return;
    prey = next;
    options.onPrey?.(aquarium?.fish.find((fish) => fish.key === next) ?? null);
  };

  const step = () => {
    timer = setTimeout(step, 1000 / AQUARIUM_FPS);
    if (options.hidden() || input === null || aquarium === null) return;
    aquarium = stepAquarium(aquarium, {
      featuredKey: input.featuredKey,
      heldKey: pinned ?? held,
      lure,
      vents,
      random: Math.random,
    });
    tick += 1;
    paint();
    notice();
  };

  const launch = (resident: AquariumResident, from: AquariumPoint, size: AquariumSize) => {
    const flight = options.leap(resident, from, size, tick);
    leaps.set(resident.key, flight);
    void flight.landed.then(
      () => {
        leaps.delete(resident.key);
        if (
          aquarium !== null &&
          input?.residents.some((current) => current.key === resident.key) &&
          !aquarium.fish.some((fish) => fish.key === resident.key)
        )
          aquarium = {
            ...aquarium,
            fish: [
              ...aquarium.fish,
              { ...flight.spot, y: flight.spot.y - fishBob(resident.key, tick) },
            ],
          };
        paint();
      },
      () => leaps.delete(resident.key),
    );
  };

  return {
    update(next: TankInput) {
      const previous = input;
      input = next;
      const before = previous?.seabed ?? null;
      if (next.seabed?.since !== before?.since) sprouts.clear();
      else if (next.seabed !== null && before !== null && !next.reducedMotion) {
        const known = new Set(before.plants.map((plant) => plant.key));
        for (const plant of next.seabed.plants)
          if (!known.has(plant.key)) sprouts.set(plant.key, tick);
      }
      vents = next.seabed?.plants.map((plant) => plant.x) ?? [];
      if (next.reducedMotion) {
        clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) timer = setTimeout(step, 1000 / AQUARIUM_FPS);
      if (next.size === null) return;
      if (!next.reducedMotion)
        for (const resident of next.residents) {
          if (leaps.has(resident.key) || aquarium?.fish.some((fish) => fish.key === resident.key))
            continue;
          const from = takeRelease(resident.key);
          if (from !== null) launch(resident, from, next.size);
        }
      const residents = next.residents.filter((resident) => !leaps.has(resident.key));
      if (aquarium === null)
        aquarium =
          resting === null
            ? createAquarium(next.size, residents, next.featuredKey, Math.random)
            : stockAquarium(resizeAquarium(resting.aquarium, next.size), residents, Math.random);
      else if (previous?.size !== next.size) aquarium = resizeAquarium(aquarium, next.size);
      if (previous !== null && castOf(previous.residents) !== castOf(next.residents))
        aquarium = next.reducedMotion
          ? createAquarium(aquarium, residents, next.featuredKey, Math.random)
          : stockAquarium(aquarium, residents, Math.random);
      if (!next.reducedMotion)
        aquarium = dropPearls(aquarium, finishedResidents(seen, next.residents));
      stash = creditStash(stash, seen, next.residents);
      seen = next.residents;
      paint();
    },
    hold(key: string | null) {
      held = key;
    },
    pin(key: string | null) {
      pinned = key;
    },
    release() {
      if (aquarium === null) return;
      aquarium = releasePrey(aquarium);
      notice();
    },
    tap(at: AquariumPoint) {
      if (input === null || input.reducedMotion || aquarium === null) return;
      ({ aquarium, stash } = tapAquarium(aquarium, stash, at));
      paint();
    },
    grab(at: AquariumPoint) {
      if (input === null || input.reducedMotion || aquarium === null) return;
      lure = sharkAt(aquarium, at) ? at : null;
    },
    drag(from: AquariumPoint, to: AquariumPoint) {
      if (input === null || input.reducedMotion || aquarium === null) return;
      if (lure !== null) lure = to;
      else
        aquarium = stirAquarium(aquarium, {
          from,
          to,
          residents: input.residents,
          featuredKey: input.featuredKey,
          heldKey: pinned ?? held,
        });
    },
    letGo() {
      lure = null;
    },
    findFish(key: string) {
      return aquarium?.fish.find((fish) => fish.key === key) ?? null;
    },
    fishAt(x: number, y: number) {
      return (
        aquarium?.fish.find((fish) => {
          const { width, height } = fishSize(fish.key);
          return (
            fish.wait === 0 &&
            x >= fish.x - 2 &&
            x < fish.x + width + 2 &&
            y >= fish.y - 2 &&
            y < fish.y + height + 2
          );
        }) ?? null
      );
    },
    stop() {
      clearTimeout(timer);
      for (const flight of leaps.values()) flight.cancel();
      if (aquarium !== null) resting = { aquarium: releasePrey(aquarium), tick };
    },
  };
}
