import type { AgentCue } from "./agents.ts";
import { aquariumHash, fishSpecies, SPECIES } from "./creatures.ts";

export const AQUARIUM_PIXEL = 3;
export const AQUARIUM_FPS = 10;
export const AQUARIUM_SAND = 8;

export const FULL_TICKS = 10 * AQUARIUM_FPS;

const PARKING_SPEED = 2;
const BUBBLE_CHANCE = 0.08;
const LEAP_REACH = 20;
const LEAP_FRAMES = 12;
const LEAP_MAX_TILT = 60;
const PELLET_SINK = 0.4;
const PELLET_REST = 30 * AQUARIUM_FPS;
const PELLET_LIMIT = 8;
const PEARL_SINK = 1;
const PEARL_LIMIT = 12;
const PEARL_REACH = 4;
const CHASE_RANGE = 48;
const CHASE_BOOST = 1.6;
const DART_RANGE = 80;
const DART_BOOST = 2.2;
const TOUCH_REACH = 2;
const SNAP_REACH = 3;
const STIR_RADIUS = 24;
const STIR_PUSH = 1.5;
const SCHOOL_RADIUS = 16;
const CURRENT_DECAY = 0.85;
const CURRENT_REST = 0.05;
const RIPPLE_TICKS = 6;
const FEEDER_CAP = 9;
const ITEMS_PER_PELLET = 4;
const FINISH_BONUS = 3;
const FLEE_BOOST = 5;

export const SHARK = {
  speed: 4,
  cruise: 0.8,
  fright: 48,
  stroke: 3,
  frames: [
    [
      "f.........f.........",
      "ff.......ff.........",
      ".ff....xxxxxx.......",
      "..fxxxxxxxxxxxxx....",
      "...xxxxxxxxxxxxxxx..",
      "..fxxxxxxxxxxxxxxexx",
      ".ffooooooooooooooooo",
      "ff....oooooooooooo..",
      "f.......off.........",
      ".........f..........",
    ],
    [
      ".f........f.........",
      ".ff......ff.........",
      "..ff...xxxxxx.......",
      "..fxxxxxxxxxxxxx....",
      "..fxxxxxxxxxxxxxxx..",
      "..fxxxxxxxxxxxxxxexx",
      "..foooooooooooooooo.",
      ".ff...oooooooooooo..",
      ".f......off.........",
      ".........f..........",
    ],
  ],
} as const;

export interface AquariumResident {
  readonly key: string;
  readonly projectKey: string;
  readonly cue: AgentCue;
  readonly items: number;
}

export interface AquariumPoint {
  readonly x: number;
  readonly y: number;
}

export interface AquariumFish {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly wait: number;
  readonly full: number;
  readonly drift: AquariumPoint;
}

export interface AquariumShark {
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly lane: number;
  readonly prey: string | null;
  readonly sated: boolean;
}

export interface AquariumBubble {
  readonly x: number;
  readonly y: number;
  readonly big: boolean;
}

export interface AquariumPellet {
  readonly x: number;
  readonly y: number;
  readonly rest: number;
}

export interface AquariumPearl {
  readonly x: number;
  readonly y: number;
  readonly projectKey: string;
}

export interface AquariumSize {
  readonly width: number;
  readonly height: number;
  readonly top: number;
}

export interface Aquarium extends AquariumSize {
  readonly fish: ReadonlyArray<AquariumFish>;
  readonly bubbles: ReadonlyArray<AquariumBubble>;
  readonly pellets: ReadonlyArray<AquariumPellet>;
  readonly pearls: ReadonlyArray<AquariumPearl>;
  readonly shark: AquariumShark;
  readonly ripple: { readonly x: number; readonly y: number; readonly age: number } | null;
}

export interface AquariumStash {
  readonly food: number;
  readonly strand: ReadonlyArray<string>;
}

export const FRESH_STASH: AquariumStash = { food: 3, strand: [] };

const STILL: AquariumPoint = { x: 0, y: 0 };

type Random = () => number;

interface Sprite {
  readonly width: number;
  readonly height: number;
}

export function fishTraits(key: string) {
  const hash = aquariumHash(key);
  const species = fishSpecies(key);
  return {
    species,
    diet: SPECIES[species].diet,
    speed: SPECIES[species].speed * (0.8 + ((hash >>> 8) % 9) * 0.05),
    depth: (hash >>> 16) % 2 === 0 ? 1 : 0.72,
    phase: (hash >>> 20) % 24,
  };
}

function frameSize(rows: ReadonlyArray<string>): Sprite {
  return { width: rows[0]!.length, height: rows.length };
}

export function fishSize(key: string) {
  return frameSize(SPECIES[fishTraits(key).species].frames[0]);
}

const SHARK_SPRITE = frameSize(SHARK.frames[0]);

export function featuredResident<T extends { readonly cue: AgentCue }>(
  residents: ReadonlyArray<T>,
): T | null {
  return residents.find((resident) => resident.cue !== "working") ?? null;
}

export function parkingSpot(size: AquariumSize, key: string) {
  return { x: Math.round(size.width / 2 - fishSize(key).width / 2), y: size.top };
}

export function landingSpot(size: AquariumSize, key: string, fromX: number): AquariumFish {
  const { width } = fishSize(key);
  const dir = fromX < size.width / 2 ? 1 : -1;
  return {
    key,
    dir,
    x: Math.max(0, Math.min(size.width - width, Math.round(fromX - width / 2 + dir * LEAP_REACH))),
    y: size.top,
    wait: 0,
    full: 0,
    drift: STILL,
  };
}

export interface LeapFrame extends AquariumPoint {
  readonly tilt: number;
  readonly scale: number;
  readonly opacity: number;
}

export function leapPath(
  from: AquariumPoint,
  to: AquariumPoint,
  dir: 1 | -1,
): ReadonlyArray<LeapFrame> {
  const bend = { x: from.x, y: to.y };
  return Array.from({ length: LEAP_FRAMES + 1 }, (_, index) => {
    const t = index / LEAP_FRAMES;
    const along = (start: number, middle: number, end: number) =>
      (1 - t) ** 2 * start + 2 * (1 - t) * t * middle + t ** 2 * end;
    const heading = (start: number, middle: number, end: number) =>
      (1 - t) * (middle - start) + t * (end - middle);
    const x = along(from.x, bend.x, to.x);
    const y = along(from.y, bend.y, to.y);
    const angle = Math.atan2(heading(from.y, bend.y, to.y), heading(from.x, bend.x, to.x) * dir);
    const tilt = Math.max(-LEAP_MAX_TILT, Math.min(LEAP_MAX_TILT, ((angle * 180) / Math.PI) * dir));
    const scale = 0.6 + 0.4 * Math.min(1, t * 2.5);
    return { x, y, tilt, scale, opacity: Math.min(1, t * 5) };
  });
}

function swimBottom(size: AquariumSize, sprite: Sprite) {
  return Math.max(size.top, size.height - AQUARIUM_SAND - 2 - sprite.height);
}

function inBand(size: AquariumSize, sprite: Sprite, y: number) {
  return Math.min(swimBottom(size, sprite), Math.max(size.top, y));
}

function seabed(size: AquariumSize) {
  return size.height - AQUARIUM_SAND - 1;
}

function sharkLane(size: AquariumSize, random: Random) {
  return Math.round(size.top + random() * (swimBottom(size, SHARK_SPRITE) - size.top));
}

function swimRow(size: AquariumSize, key: string, random: Random) {
  const bottom = swimBottom(size, fishSize(key));
  if (fishTraits(key).diet === "crawl") return bottom;
  return Math.round(size.top + random() * (bottom - size.top));
}

function jitter(random: Random) {
  return random() < 0.15 ? (random() < 0.5 ? -1 : 1) : 0;
}

function enter(size: AquariumSize, key: string, random: Random): AquariumFish {
  const dir = random() < 0.5 ? 1 : -1;
  return {
    key,
    dir,
    x: dir === 1 ? -fishSize(key).width : size.width,
    y: swimRow(size, key, random),
    wait: Math.floor(random() * 30),
    full: 0,
    drift: STILL,
  };
}

function scatter(size: AquariumSize, key: string, random: Random): AquariumFish {
  return {
    key,
    dir: random() < 0.5 ? 1 : -1,
    x: Math.round(random() * (size.width - fishSize(key).width)),
    y: swimRow(size, key, random),
    wait: 0,
    full: 0,
    drift: STILL,
  };
}

export function createAquarium(
  size: AquariumSize,
  residents: ReadonlyArray<AquariumResident>,
  featuredKey: string | null,
  random: Random,
): Aquarium {
  const lane = sharkLane(size, random);
  return {
    ...size,
    fish: residents.map((resident) =>
      resident.key === featuredKey
        ? {
            key: resident.key,
            dir: 1,
            wait: 0,
            full: 0,
            drift: STILL,
            ...parkingSpot(size, resident.key),
          }
        : scatter(size, resident.key, random),
    ),
    bubbles: [],
    pellets: [],
    pearls: [],
    shark: {
      x: Math.round(random() * (size.width - SHARK_SPRITE.width)),
      y: lane,
      dir: random() < 0.5 ? 1 : -1,
      lane,
      prey: null,
      sated: false,
    },
    ripple: null,
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
      y: Math.min(fish.y, swimBottom(size, fishSize(fish.key))),
    })),
    bubbles: aquarium.bubbles.filter((bubble) => bubble.x < size.width && bubble.y < size.height),
    pellets: aquarium.pellets.map((pellet) => ({
      ...pellet,
      x: Math.min(pellet.x, size.width - 1),
      y: Math.min(pellet.y, seabed(size)),
    })),
    pearls: aquarium.pearls.map((pearl) => ({
      ...pearl,
      x: Math.min(pearl.x, size.width - 2),
      y: Math.min(pearl.y, seabed(size)),
    })),
    shark: {
      ...aquarium.shark,
      x: Math.min(aquarium.shark.x, size.width - SHARK_SPRITE.width),
      y: Math.min(aquarium.shark.y, swimBottom(size, SHARK_SPRITE)),
    },
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
    full: fish.full,
    drift: STILL,
  };
}

function free(
  fish: AquariumFish,
  input: { readonly featuredKey: string | null; readonly heldKey: string | null },
) {
  return fish.key !== input.featuredKey && fish.key !== input.heldKey && fish.wait === 0;
}

function centerOf(fish: AquariumFish): AquariumPoint {
  const { width, height } = fishSize(fish.key);
  return { x: fish.x + width / 2, y: fish.y + height / 2 };
}

function inside(size: AquariumSize, fish: AquariumFish) {
  const { x } = centerOf(fish);
  return x >= 0 && x < size.width;
}

function touches(body: AquariumPoint, sprite: Sprite, at: AquariumPoint) {
  return (
    at.x >= body.x - TOUCH_REACH &&
    at.x < body.x + sprite.width + TOUCH_REACH &&
    at.y >= body.y - TOUCH_REACH &&
    at.y < body.y + sprite.height + TOUCH_REACH
  );
}

function edible(aquarium: Aquarium, key: string, pellet: AquariumPellet) {
  const { diet } = fishTraits(key);
  return (diet !== "graze" && diet !== "crawl") || pellet.y >= seabed(aquarium);
}

function bites(fish: AquariumFish, pellet: AquariumPellet) {
  const { width, height } = fishSize(fish.key);
  const { diet, species } = fishTraits(fish.key);
  if (diet === "snap") {
    const snoutX = fish.dir === 1 ? fish.x + width - 1 : fish.x;
    const snoutY = fish.y + SPECIES[species].frames[0].findIndex((row) => row.includes("e"));
    return Math.abs(pellet.x - snoutX) <= SNAP_REACH && Math.abs(pellet.y - snoutY) <= SNAP_REACH;
  }
  if (diet === "absorb")
    return (
      pellet.x >= fish.x &&
      pellet.x < fish.x + width &&
      pellet.y >= fish.y &&
      pellet.y < fish.y + height / 2
    );
  return touches(fish, { width, height }, pellet);
}

function nearestMeal(aquarium: Aquarium, fish: AquariumFish) {
  const { diet } = fishTraits(fish.key);
  const range =
    diet === "dart" ? DART_RANGE : diet === "chase" || diet === "graze" ? CHASE_RANGE : 0;
  const center = centerOf(fish);
  const away = (pellet: AquariumPellet) => Math.hypot(pellet.x - center.x, pellet.y - center.y);
  return aquarium.pellets
    .filter((pellet) => away(pellet) < range && edible(aquarium, fish.key, pellet))
    .sort((left, right) => away(left) - away(right))[0];
}

function glide<T extends AquariumFish | AquariumShark>(
  body: T,
  to: AquariumPoint,
  speed: number,
): T {
  const dx = to.x - body.x;
  const dy = to.y - body.y;
  const pull = Math.min(1, speed / Math.hypot(dx, dy));
  return {
    ...body,
    x: body.x + dx * pull,
    y: body.y + dy * pull,
    dir: Math.abs(dx) < 1 ? body.dir : dx > 0 ? 1 : -1,
  };
}

function chase(aquarium: Aquarium, fish: AquariumFish, pellet: AquariumPellet): AquariumFish {
  const sprite = fishSize(fish.key);
  const { diet, speed } = fishTraits(fish.key);
  return glide(
    fish,
    { x: pellet.x - sprite.width / 2, y: inBand(aquarium, sprite, pellet.y - sprite.height / 2) },
    speed * (diet === "dart" ? DART_BOOST : CHASE_BOOST),
  );
}

function steer(size: AquariumSize, shark: AquariumShark, to: AquariumPoint): AquariumShark {
  const steered = glide(
    shark,
    {
      x: Math.max(0, Math.min(size.width - SHARK_SPRITE.width, to.x - SHARK_SPRITE.width / 2)),
      y: inBand(size, SHARK_SPRITE, to.y - SHARK_SPRITE.height / 2),
    },
    SHARK.speed,
  );
  return { ...steered, lane: steered.y };
}

function patrol(size: AquariumSize, shark: AquariumShark, random: Random): AquariumShark {
  const wall = shark.dir === 1 ? size.width - SHARK_SPRITE.width : 0;
  if (shark.x === wall)
    return { ...shark, dir: shark.dir === 1 ? -1 : 1, lane: sharkLane(size, random) };
  return glide(shark, { x: wall, y: inBand(size, SHARK_SPRITE, shark.lane) }, SHARK.cruise);
}

function mouthOf(shark: AquariumShark): AquariumPoint {
  const { width, height } = SHARK_SPRITE;
  return { x: shark.dir === 1 ? shark.x + width - 1 : shark.x, y: shark.y + height / 2 };
}

function flee(fish: AquariumFish, shark: AquariumShark): AquariumFish {
  const center = centerOf(fish);
  const mouth = mouthOf(shark);
  const dx = center.x - mouth.x;
  const dy = center.y - mouth.y;
  const away = Math.max(1, Math.hypot(dx, dy));
  const fear = 1 - away / SHARK.fright;
  const { diet, speed } = fishTraits(fish.key);
  if (fear <= 0 || diet === "crawl") return fish;
  const push = speed * FLEE_BOOST * fear;
  return {
    ...fish,
    dir: Math.abs(dx) < 1 ? fish.dir : dx > 0 ? 1 : -1,
    drift: { x: (dx / away) * push, y: (dy / away) * push },
  };
}

function drift(aquarium: Aquarium, fish: AquariumFish): AquariumFish {
  if (fish.drift === STILL) return fish;
  const decayed = { x: fish.drift.x * CURRENT_DECAY, y: fish.drift.y * CURRENT_DECAY };
  return {
    ...fish,
    x: fish.x + fish.drift.x,
    y: inBand(aquarium, fishSize(fish.key), fish.y + fish.drift.y),
    drift: Math.hypot(decayed.x, decayed.y) < CURRENT_REST ? STILL : decayed,
  };
}

function swim(aquarium: Aquarium, fish: AquariumFish, random: Random): AquariumFish {
  if (fish.wait > 0) return { ...fish, wait: fish.wait - 1 };
  const bottom = swimBottom(aquarium, fishSize(fish.key));
  if (fishTraits(fish.key).diet === "crawl" && fish.y < bottom)
    return { ...fish, y: Math.min(bottom, fish.y + 1) };
  const drifting = drift(aquarium, fish);
  const meal = fish.full === 0 ? nearestMeal(aquarium, drifting) : undefined;
  if (meal !== undefined) return chase(aquarium, drifting, meal);
  const x = drifting.x + drifting.dir * fishTraits(fish.key).speed;
  if (x > aquarium.width || x < -fishSize(fish.key).width) return enter(aquarium, fish.key, random);
  return { ...drifting, x };
}

export function stepAquarium(
  aquarium: Aquarium,
  input: {
    readonly featuredKey: string | null;
    readonly heldKey: string | null;
    readonly lure: AquariumPoint | null;
    readonly vents: ReadonlyArray<number>;
    readonly random: Random;
  },
): Aquarium {
  const { random, vents } = input;
  const floor = aquarium.height - AQUARIUM_SAND - 2;
  const spawned =
    random() < BUBBLE_CHANCE && vents.length > 0
      ? [{ x: vents[Math.floor(random() * vents.length)]!, y: floor, big: random() < 0.3 }]
      : [];
  const bottom = seabed(aquarium);
  const shark =
    aquarium.shark.prey !== null
      ? aquarium.shark
      : input.lure === null
        ? patrol(aquarium, aquarium.shark, random)
        : steer(aquarium, aquarium.shark, input.lure);
  const mouth = mouthOf(shark);
  let pellets = aquarium.pellets;
  const fed = aquarium.fish
    .map((fish) =>
      fish.key === input.heldKey || fish.key === shark.prey
        ? fish
        : fish.key === input.featuredKey
          ? park(aquarium, fish)
          : swim(aquarium, input.lure === null ? fish : flee(fish, shark), random),
    )
    .map((fish) => {
      if (fish.full > 0) return { ...fish, full: fish.full - 1 };
      const meal = free(fish, input)
        ? pellets.find((pellet) => edible(aquarium, fish.key, pellet) && bites(fish, pellet))
        : undefined;
      if (meal === undefined) return fish;
      pellets = pellets.filter((pellet) => pellet !== meal);
      return { ...fish, full: FULL_TICKS };
    });
  const touching = fed.filter(
    (fish) =>
      free(fish, input) && inside(aquarium, fish) && touches(fish, fishSize(fish.key), mouth),
  );
  const prey = input.lure !== null && shark.prey === null && !shark.sated ? touching[0] : undefined;
  return {
    ...aquarium,
    fish: fed,
    shark: {
      ...shark,
      prey: prey?.key ?? (fed.some((fish) => fish.key === shark.prey) ? shark.prey : null),
      sated: shark.sated && touching.length > 0,
    },
    pellets: pellets.flatMap((pellet) =>
      pellet.y < bottom
        ? [
            {
              ...pellet,
              x: pellet.x + jitter(random),
              y: Math.min(bottom, pellet.y + PELLET_SINK),
            },
          ]
        : pellet.rest < PELLET_REST
          ? [{ ...pellet, rest: pellet.rest + 1 }]
          : [],
    ),
    pearls: aquarium.pearls.map((pearl) => ({
      ...pearl,
      y: Math.min(bottom, pearl.y + PEARL_SINK),
    })),
    ripple:
      aquarium.ripple === null || aquarium.ripple.age >= RIPPLE_TICKS
        ? null
        : { ...aquarium.ripple, age: aquarium.ripple.age + 1 },
    bubbles: [
      ...aquarium.bubbles.flatMap((bubble) =>
        bubble.y > 2 ? [{ ...bubble, x: bubble.x + jitter(random), y: bubble.y - 1 }] : [],
      ),
      ...spawned,
    ],
  };
}

export function stirAquarium(
  aquarium: Aquarium,
  input: {
    readonly from: AquariumPoint;
    readonly to: AquariumPoint;
    readonly residents: ReadonlyArray<AquariumResident>;
    readonly featuredKey: string | null;
    readonly heldKey: string | null;
  },
): Aquarium {
  const dx = input.to.x - input.from.x;
  const dy = input.to.y - input.from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return aquarium;
  const projects = new Map(input.residents.map((resident) => [resident.key, resident.projectKey]));
  const stirred = aquarium.fish.flatMap((fish) => {
    const center = centerOf(fish);
    const reach = 1 - Math.hypot(center.x - input.to.x, center.y - input.to.y) / STIR_RADIUS;
    return reach > 0 && free(fish, input) && fishTraits(fish.key).diet !== "crawl"
      ? [{ fish, center, reach }]
      : [];
  });
  const push = (strength: number) => ({
    x: (dx / length) * STIR_PUSH * strength,
    y: (dy / length) * STIR_PUSH * strength,
  });
  return {
    ...aquarium,
    fish: aquarium.fish.map((fish) => {
      const stir = stirred.find((candidate) => candidate.fish === fish);
      if (stir === undefined) return fish;
      const schooled = stirred.some(
        (mate) =>
          mate !== stir &&
          projects.get(mate.fish.key) === projects.get(fish.key) &&
          Math.hypot(mate.center.x - stir.center.x, mate.center.y - stir.center.y) <= SCHOOL_RADIUS,
      );
      return schooled
        ? { ...fish, dir: dx === 0 ? fish.dir : dx > 0 ? 1 : -1, drift: push(1) }
        : { ...fish, drift: push(stir.reach) };
    }),
  };
}

export function releasePrey(aquarium: Aquarium): Aquarium {
  return aquarium.shark.prey === null
    ? aquarium
    : { ...aquarium, shark: { ...aquarium.shark, prey: null, sated: true } };
}

export function sharkAt(aquarium: Aquarium, at: AquariumPoint) {
  return touches(aquarium.shark, SHARK_SPRITE, at);
}

export function finishedResidents(
  previous: ReadonlyArray<AquariumResident>,
  next: ReadonlyArray<AquariumResident>,
) {
  const before = new Map(previous.map((resident) => [resident.key, resident.cue]));
  return next.filter(
    (resident) => resident.cue === "ready" && before.get(resident.key) === "working",
  );
}

export function creditStash(
  stash: AquariumStash,
  previous: ReadonlyArray<AquariumResident>,
  next: ReadonlyArray<AquariumResident>,
): AquariumStash {
  const before = new Map(previous.map((resident) => [resident.key, resident.items]));
  const items = next.reduce(
    (total, resident) =>
      total + Math.max(0, resident.items - (before.get(resident.key) ?? resident.items)),
    0,
  );
  return {
    ...stash,
    food: Math.min(
      FEEDER_CAP,
      stash.food +
        items / ITEMS_PER_PELLET +
        finishedResidents(previous, next).length * FINISH_BONUS,
    ),
  };
}

export function dropPearls(
  aquarium: Aquarium,
  finished: ReadonlyArray<AquariumResident>,
): Aquarium {
  const finishers = new Map(finished.map((resident) => [resident.key, resident.projectKey]));
  const dropped = aquarium.fish.flatMap((fish) => {
    const projectKey = finishers.get(fish.key);
    if (projectKey === undefined) return [];
    const { width, height } = fishSize(fish.key);
    return [
      {
        x: Math.max(0, Math.min(aquarium.width - 2, Math.round(fish.x + width / 2) - 1)),
        y: Math.min(seabed(aquarium), Math.round(fish.y + height)),
        projectKey,
      },
    ];
  });
  return { ...aquarium, pearls: [...aquarium.pearls, ...dropped].slice(-PEARL_LIMIT) };
}

export function tapAquarium(aquarium: Aquarium, stash: AquariumStash, at: AquariumPoint) {
  const pearl = aquarium.pearls.find(
    (candidate) =>
      Math.abs(candidate.x + 1 - at.x) <= PEARL_REACH &&
      Math.abs(candidate.y + 1 - at.y) <= PEARL_REACH,
  );
  if (pearl !== undefined)
    return {
      aquarium: { ...aquarium, pearls: aquarium.pearls.filter((candidate) => candidate !== pearl) },
      stash: { ...stash, strand: [...stash.strand, pearl.projectKey] },
    };
  const x = Math.round(at.x);
  const y = Math.min(seabed(aquarium), at.y);
  if (stash.food < 1 || aquarium.pellets.length >= PELLET_LIMIT)
    return { aquarium: { ...aquarium, ripple: { x, y: Math.round(y), age: 0 } }, stash };
  return {
    aquarium: { ...aquarium, pellets: [...aquarium.pellets, { x, y, rest: 0 }] },
    stash: { ...stash, food: stash.food - 1 },
  };
}
