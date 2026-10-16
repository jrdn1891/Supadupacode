import type { AgentCue } from "./agents.ts";
import { cueMark, fishColors, SPECIES } from "./creatures.ts";
import { type AquariumPlant, GROW_TICKS } from "./seabed.ts";
import {
  AQUARIUM_SAND,
  type Aquarium,
  type AquariumFish,
  type AquariumResident,
  type AquariumStash,
  FULL_TICKS,
  fishTraits,
  PETS,
} from "./simulation.ts";

export type AquariumAppearance = "light" | "dark";

export interface AquariumPen {
  fill(color: string, x: number, y: number, width: number, height: number): void;
  alpha(value: number): void;
}

export const CUE_RISE = 13;

const AFTER_MEAL = 15;

const SCENERY = {
  dark: {
    water: ["#0f1f2d", "#0d1b28", "#0b1722", "#0a131d", "#091018"],
    surface: "#18304a",
    ray: "#aad2ff",
    rayAlpha: 0.045,
    sand: ["#1a1610", "#2a2419", "#110e09"],
    rock: ["#19202a", "#242d39"],
    weed: ["#17493a", "#215e4a"],
    bubble: "rgba(150,200,220,0.55)",
    eye: "#0b0f16",
    pellet: "#c8955a",
  },
  light: {
    water: ["#f2f8fb", "#eaf3f8", "#e2eef5", "#dae9f1", "#d2e3ed"],
    surface: "#ffffff",
    ray: "#ffffff",
    rayAlpha: 0.5,
    sand: ["#e6dbc4", "#f0e7d4", "#d4c6a9"],
    rock: ["#c2ccd6", "#d3dbe3"],
    weed: ["#4f8a6f", "#62a083"],
    bubble: "rgba(110,160,190,0.6)",
    eye: "#1b2330",
    pellet: "#9a6a3a",
  },
} as const;

const PET_COLORS = {
  clownfish: { x: "#f07a2c", w: "#fbf3e8", f: "#c4531c" },
  shark: { x: "#6f8399", o: "#b9c6d2", f: "#53667b" },
} as const;

const HEART = ["#.#", "###", ".#."];

const RAYS = [
  { at: 0.14, width: 9 },
  { at: 0.44, width: 5 },
  { at: 0.62, width: 13 },
];

const ROCKS = [
  { at: 0.22, width: 14, height: 6 },
  { at: 0.31, width: 7, height: 3 },
  { at: 0.86, width: 16, height: 7 },
];

export function sceneryPalette(appearance: AquariumAppearance) {
  const look = SCENERY[appearance];
  return [look.surface, ...look.water, ...look.sand];
}

export function sceneryPixel(
  appearance: AquariumAppearance,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const bands = SCENERY[appearance].water.length;
  const waterHeight = height - AQUARIUM_SAND;
  const band = (y / waterHeight) * bands;
  const row = Math.floor(band);
  const blend = band - row > 0.72 && row < bands - 1;
  const checker = (x + y) % 2 === 0;
  const speck = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return y === 0 && checker
    ? 0
    : y < waterHeight
      ? 1 + (blend && checker ? row + 1 : row)
      : y === waterHeight && !checker
        ? bands
        : 1 + bands + (speck % 11 === 0 ? 1 : speck % 13 === 0 ? 2 : 0);
}

export function paintSceneryDetails(
  pen: AquariumPen,
  width: number,
  height: number,
  appearance: AquariumAppearance,
) {
  const look = SCENERY[appearance];
  const waterHeight = height - AQUARIUM_SAND;
  const rayLength = waterHeight * 0.8;
  for (const ray of RAYS) {
    for (let y = 1; y < rayLength; y++) {
      pen.alpha(look.rayAlpha * (1 - y / rayLength));
      pen.fill(look.ray, Math.round(width * ray.at + y * 0.35), y, ray.width, 1);
    }
  }
  pen.alpha(1);
  for (const rock of ROCKS) {
    const radius = rock.width / 2;
    for (let dy = -rock.height; dy <= 0; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if ((dx / radius) ** 2 + (dy / rock.height) ** 2 > 1) continue;
        pen.fill(
          look.rock[dx < 0 && dy < -rock.height / 2 ? 1 : 0],
          Math.round(width * rock.at + dx),
          waterHeight + dy,
          1,
          1,
        );
      }
    }
  }
}

function paintGlyph(
  pen: AquariumPen,
  color: string,
  glyph: ReadonlyArray<string>,
  left: number,
  top: number,
) {
  glyph.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] === "#") pen.fill(color, left + x, top + y, 1, 1);
  });
}

function paintPearl(pen: AquariumPen, projectKey: string, x: number, y: number) {
  const colors = fishColors(projectKey);
  pen.fill(colors.x, x, y, 2, 2);
  pen.fill(colors.o, x, y, 1, 1);
}

function paintSprite(
  pen: AquariumPen,
  rows: ReadonlyArray<string>,
  palette: Readonly<Record<string, string>>,
  left: number,
  top: number,
  dir: 1 | -1,
) {
  const width = rows[0]!.length;
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const color = palette[row.charAt(x)];
      if (color === undefined) continue;
      pen.fill(color, dir === 1 ? left + x : left + width - 1 - x, top + y, 1, 1);
    }
  });
}

function paintCue(pen: AquariumPen, cue: AgentCue, left: number, top: number) {
  if (cue === "working") return;
  const { rows, palette } = cueMark(cue);
  paintSprite(pen, rows, palette, left, top, 1);
}

export function fishBob(key: string, tick: number) {
  const { phase, species } = fishTraits(key);
  const { stroke, bob } = SPECIES[species];
  return Math.round(Math.sin(((tick + phase) * Math.PI) / (stroke * 5)) * bob);
}

export function paintFish(
  pen: AquariumPen,
  fish: AquariumFish,
  resident: AquariumResident | undefined,
  tick: number,
  appearance: AquariumAppearance,
) {
  const traits = fishTraits(fish.key);
  const look = SPECIES[traits.species];
  const { frames, stroke } = look;
  const colors = fishColors(resident?.projectKey ?? fish.key);
  const palette: Readonly<Record<string, string>> = {
    x: colors.x,
    o: colors.o,
    f: colors.f,
    e: SCENERY[appearance].eye,
  };
  const sinceMeal = FULL_TICKS - fish.full;
  const savoring = fish.full > 0 && sinceMeal < AFTER_MEAL;
  const [still] = frames;
  const rows =
    savoring && "puffed" in look
      ? look.puffed
      : frames[Math.floor((tick + traits.phase) / stroke) % frames.length]!;
  const width = rows[0].length;
  const left = Math.round(fish.x) - (width - still[0].length) / 2;
  const top = Math.round(fish.y) - (rows.length - still.length) / 2 + fishBob(fish.key, tick);
  pen.alpha(traits.depth);
  paintSprite(pen, rows, palette, left, top, fish.dir);
  if (savoring) {
    pen.alpha(1 - sinceMeal / AFTER_MEAL);
    paintGlyph(
      pen,
      colors.x,
      HEART,
      left + Math.round(width / 2) - 1,
      top - 4 - Math.floor(sinceMeal / 2),
    );
  }
  pen.alpha(1);
  if (resident !== undefined)
    paintCue(pen, resident.cue, left + Math.round(width / 2) - 5, top - CUE_RISE);
}

export function paintAquarium(
  pen: AquariumPen,
  input: {
    readonly aquarium: Aquarium;
    readonly residents: ReadonlyMap<string, AquariumResident>;
    readonly tick: number;
    readonly appearance: AquariumAppearance;
    readonly stash: AquariumStash | null;
    readonly plants: ReadonlyArray<AquariumPlant>;
    readonly sprouts: ReadonlyMap<string, number>;
  },
) {
  const { aquarium, tick } = input;
  const look = SCENERY[input.appearance];
  const floor = aquarium.height - AQUARIUM_SAND - 1;
  for (const plant of input.plants) {
    const sprout = input.sprouts.get(plant.key);
    const grown = sprout === undefined ? 1 : Math.min(1, (tick - sprout) / GROW_TICKS);
    if (plant.kind === "coral") {
      const width = plant.form[0].length;
      const left = Math.max(0, Math.min(aquarium.width - width, plant.x - Math.floor(width / 2)));
      const hidden = Math.round(plant.form.length * (1 - grown));
      paintSprite(
        pen,
        plant.form.slice(hidden),
        fishColors(plant.projectKey),
        left,
        floor + 1 - plant.form.length + hidden,
        1,
      );
      continue;
    }
    const height = Math.ceil(plant.height * grown);
    for (let step = 0; step < height; step++) {
      const sway = Math.sin(tick * 0.13 + step * 0.28 + plant.phase) * (step / plant.height) * 1.6;
      const x = plant.x + Math.round(sway);
      const color = look.weed[step % 3 === 0 ? 0 : 1];
      pen.fill(color, x, floor - step, 1, 1);
      if (step % 4 === 2) pen.fill(color, x + (step % 8 === 2 ? 1 : -1), floor - step, 1, 1);
    }
  }
  for (const bubble of aquarium.bubbles) {
    if (!bubble.big) {
      pen.fill(look.bubble, bubble.x, bubble.y, 1, 1);
      continue;
    }
    pen.fill(look.bubble, bubble.x, bubble.y - 1, 1, 1);
    pen.fill(look.bubble, bubble.x - 1, bubble.y, 1, 1);
    pen.fill(look.bubble, bubble.x + 1, bubble.y, 1, 1);
    pen.fill(look.bubble, bubble.x, bubble.y + 1, 1, 1);
  }
  for (const pearl of aquarium.pearls) paintPearl(pen, pearl.projectKey, pearl.x, pearl.y);
  for (const pellet of aquarium.pellets)
    pen.fill(look.pellet, Math.round(pellet.x), Math.round(pellet.y), 1, 1);
  const byDepth = [...aquarium.fish].sort(
    (left, right) => fishTraits(left.key).depth - fishTraits(right.key).depth,
  );
  for (const fish of byDepth)
    paintFish(pen, fish, input.residents.get(fish.key), tick, input.appearance);
  const { pet, ripple, width } = aquarium;
  if (pet !== null) {
    const { frames, stroke } = PETS[pet.kind];
    paintSprite(
      pen,
      frames[Math.floor(tick / stroke) % frames.length]!,
      { ...PET_COLORS[pet.kind], e: look.eye },
      Math.round(pet.x),
      Math.round(pet.y),
      pet.dir,
    );
  }
  if (ripple !== null) {
    const radius = 1 + Math.floor(ripple.age / 2);
    for (let dx = -radius; dx <= radius; dx++) {
      const dy = radius - Math.abs(dx);
      pen.fill(look.bubble, ripple.x + dx, ripple.y + dy, 1, 1);
      if (dy !== 0) pen.fill(look.bubble, ripple.x + dx, ripple.y - dy, 1, 1);
    }
  }
  if (input.stash === null) return;
  for (let dot = 0; dot < Math.floor(input.stash.food); dot++)
    pen.fill(look.pellet, width - 3 - dot * 2, 2, 1, 1);
  input.stash.strand
    .slice(-Math.floor(width / 8))
    .forEach((projectKey, index) => paintPearl(pen, projectKey, 2 + index * 3, 2));
}
