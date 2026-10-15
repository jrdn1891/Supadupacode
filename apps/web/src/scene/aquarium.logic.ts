import type { BackstageCue } from "@supacode/contracts";

export const AQUARIUM_PIXEL = 3;
export const AQUARIUM_FPS = 6;
export const AQUARIUM_SAND = 8;

const PARKING_SPEED = 2;
const BUBBLE_CHANCE = 0.08;

export const FISH_SPRITES = {
  big: {
    rows: [
      "......ff....",
      "....xxxxx...",
      "...xxxxxxxx.",
      "..xxxxxxxexx",
      "..xxxxxxxxxx",
      "...oooooooo.",
      "....ooooo...",
      "......f.....",
    ],
    tails: [
      ["t.", "tt", ".t", ".t", "tt", "t."],
      [".t", ".t", "tt", "tt", ".t", ".t"],
    ],
    tailRow: 1,
  },
  small: {
    rows: ["...xxx..", "..xxxxex", "..oooooo", "...ooo.."],
    tails: [
      ["t.", ".t", ".t", "t."],
      [".t", "tt", "tt", ".t"],
    ],
    tailRow: 0,
  },
} as const;

export type FishKind = keyof typeof FISH_SPRITES;

export interface AquariumResident {
  readonly key: string;
  readonly projectKey: string;
  readonly cue: BackstageCue;
}

export interface AquariumFish {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly wait: number;
}

export interface AquariumBubble {
  readonly x: number;
  readonly y: number;
  readonly big: boolean;
}

export interface AquariumSize {
  readonly width: number;
  readonly height: number;
  readonly top: number;
}

export interface Aquarium extends AquariumSize {
  readonly fish: ReadonlyArray<AquariumFish>;
  readonly bubbles: ReadonlyArray<AquariumBubble>;
}

type Random = () => number;

export function aquariumHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function fishTraits(key: string) {
  const hash = aquariumHash(key);
  return {
    kind: (hash % 3 === 0 ? "small" : "big") as FishKind,
    speed: 0.35 + (hash % 7) * 0.06,
    depth: hash % 2 === 0 ? 1 : 0.72,
    phase: hash % 24,
  };
}

export function fishSize(key: string) {
  const { rows } = FISH_SPRITES[fishTraits(key).kind];
  return { width: rows[0].length, height: rows.length };
}

export function aquariumWeeds(width: number) {
  return [
    { x: Math.round(width * 0.08), height: 22, phase: 0 },
    { x: Math.round(width * 0.1), height: 14, phase: 2.4 },
    { x: Math.round(width * 0.76), height: 30, phase: 1.1 },
    { x: Math.round(width * 0.93), height: 18, phase: 3.3 },
  ];
}

export function featuredResident<T extends { readonly cue: BackstageCue }>(
  residents: ReadonlyArray<T>,
): T | null {
  return residents.find((resident) => resident.cue !== "working") ?? null;
}

export function parkingSpot(size: AquariumSize, key: string) {
  return { x: Math.round(size.width / 2 - fishSize(key).width / 2), y: size.top };
}

function swimBottom(size: AquariumSize, key: string) {
  return Math.max(size.top, size.height - AQUARIUM_SAND - 2 - fishSize(key).height);
}

function swimRow(size: AquariumSize, key: string, random: Random) {
  return Math.round(size.top + random() * (swimBottom(size, key) - size.top));
}

function enter(size: AquariumSize, key: string, random: Random): AquariumFish {
  const dir = random() < 0.5 ? 1 : -1;
  return {
    key,
    dir,
    x: dir === 1 ? -fishSize(key).width : size.width,
    y: swimRow(size, key, random),
    wait: Math.floor(random() * 30),
  };
}

function scatter(size: AquariumSize, key: string, random: Random): AquariumFish {
  return {
    key,
    dir: random() < 0.5 ? 1 : -1,
    x: Math.round(random() * (size.width - fishSize(key).width)),
    y: swimRow(size, key, random),
    wait: 0,
  };
}

export function createAquarium(
  size: AquariumSize,
  residents: ReadonlyArray<AquariumResident>,
  featuredKey: string | null,
  random: Random,
): Aquarium {
  return {
    ...size,
    fish: residents.map((resident) =>
      resident.key === featuredKey
        ? { key: resident.key, dir: 1, wait: 0, ...parkingSpot(size, resident.key) }
        : scatter(size, resident.key, random),
    ),
    bubbles: [],
  };
}

export function stockAquarium(
  aquarium: Aquarium,
  residents: ReadonlyArray<AquariumResident>,
  random: Random,
): Aquarium {
  const swimming = new Map(aquarium.fish.map((fish) => [fish.key, fish]));
  const arrive = swimming.size === 0 ? scatter : enter;
  return {
    ...aquarium,
    fish: residents.map(
      (resident) => swimming.get(resident.key) ?? arrive(aquarium, resident.key, random),
    ),
  };
}

export function resizeAquarium(aquarium: Aquarium, size: AquariumSize): Aquarium {
  return {
    ...aquarium,
    ...size,
    fish: aquarium.fish.map((fish) => ({
      ...fish,
      x: Math.min(fish.x, size.width),
      y: Math.min(fish.y, swimBottom(size, fish.key)),
    })),
    bubbles: aquarium.bubbles.filter((bubble) => bubble.x < size.width && bubble.y < size.height),
  };
}

function park(aquarium: Aquarium, fish: AquariumFish): AquariumFish {
  const spot = parkingSpot(aquarium, fish.key);
  const dx = spot.x - fish.x;
  return {
    key: fish.key,
    x: Math.abs(dx) <= PARKING_SPEED ? spot.x : fish.x + Math.sign(dx) * PARKING_SPEED,
    y: fish.y + Math.sign(spot.y - fish.y),
    dir: dx === 0 ? fish.dir : dx > 0 ? 1 : -1,
    wait: 0,
  };
}

function swim(aquarium: Aquarium, fish: AquariumFish, random: Random): AquariumFish {
  if (fish.wait > 0) return { ...fish, wait: fish.wait - 1 };
  const x = fish.x + fish.dir * fishTraits(fish.key).speed;
  if (x > aquarium.width || x < -fishSize(fish.key).width) return enter(aquarium, fish.key, random);
  return { ...fish, x };
}

export function stepAquarium(
  aquarium: Aquarium,
  input: {
    readonly featuredKey: string | null;
    readonly heldKey: string | null;
    readonly random: Random;
  },
): Aquarium {
  const { random } = input;
  const weeds = aquariumWeeds(aquarium.width);
  const floor = aquarium.height - AQUARIUM_SAND - 2;
  const spawned =
    random() < BUBBLE_CHANCE
      ? [{ x: weeds[Math.floor(random() * weeds.length)]!.x, y: floor, big: random() < 0.3 }]
      : [];
  return {
    ...aquarium,
    fish: aquarium.fish.map((fish) =>
      fish.key === input.featuredKey
        ? park(aquarium, fish)
        : fish.key === input.heldKey
          ? fish
          : swim(aquarium, fish, random),
    ),
    bubbles: [
      ...aquarium.bubbles.flatMap((bubble) =>
        bubble.y > 2
          ? [
              {
                ...bubble,
                x: bubble.x + (random() < 0.15 ? (random() < 0.5 ? -1 : 1) : 0),
                y: bubble.y - 1,
              },
            ]
          : [],
      ),
      ...spawned,
    ],
  };
}
