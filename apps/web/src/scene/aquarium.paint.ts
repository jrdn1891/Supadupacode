import type { AgentCue } from "./aquariumAgents";

import {
  AQUARIUM_SAND,
  type Aquarium,
  type AquariumFish,
  type AquariumResident,
  type AquariumStash,
  aquariumHash,
  aquariumWeeds,
  FULL_TICKS,
  fishSize,
  fishTraits,
  PETS,
  SPECIES,
} from "./aquarium.logic";

export type AquariumAppearance = "light" | "dark";

export const CUE_RISE = 13;

const AFTER_MEAL = 15;

const SCENERY = {
  dark: {
    water: ["#0f1f2d", "#0d1b28", "#0b1722", "#0a131d", "#091018"],
    surface: "#18304a",
    ray: "170,210,255",
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
    ray: "255,255,255",
    rayAlpha: 0.5,
    sand: ["#e6dbc4", "#f0e7d4", "#d4c6a9"],
    rock: ["#c2ccd6", "#d3dbe3"],
    weed: ["#4f8a6f", "#62a083"],
    bubble: "rgba(110,160,190,0.6)",
    eye: "#1b2330",
    pellet: "#9a6a3a",
  },
} as const;

const FISH_COLORS = [
  { x: "#d9965a", o: "#ecc08f", f: "#b4733c" },
  { x: "#5e9fc7", o: "#9ccbe4", f: "#3f7aa3" },
  { x: "#c97d93", o: "#e6adbd", f: "#a35d72" },
  { x: "#7cc4a0", o: "#b9e3cc", f: "#57a07d" },
  { x: "#a99ad8", o: "#cfc5ee", f: "#8676b8" },
  { x: "#d6b85a", o: "#ecd895", f: "#b0953c" },
] as const;

const PET_COLORS = {
  clownfish: { x: "#f07a2c", w: "#fbf3e8", f: "#c4531c" },
  shark: { x: "#6f8399", o: "#b9c6d2", f: "#53667b" },
} as const;

const EXCLAIM = ["...#...", "...#...", "...#...", ".......", "...#..."];
const QUESTION = ["..###..", "....#..", "...#...", ".......", "...#..."];
const CHECK = ["......#", ".....#.", "#...#..", ".#.#...", "..#...."];
const HEART = ["#.#", "###", ".#."];

const CUE_BUBBLES: Readonly<
  Record<
    Exclude<AgentCue, "working">,
    { readonly color: string; readonly glyph: ReadonlyArray<string> }
  >
> = {
  approval: { color: "#f5a524", glyph: EXCLAIM },
  limited: { color: "#f5a524", glyph: EXCLAIM },
  failed: { color: "#ef5350", glyph: EXCLAIM },
  input: { color: "#8b93f8", glyph: QUESTION },
  ready: { color: "#3fcf86", glyph: CHECK },
};

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

function packColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return (0xff << 24) | ((value & 0xff) << 16) | (value & 0xff00) | ((value >> 16) & 0xff);
}

export function paintScenery(width: number, height: number, appearance: AquariumAppearance) {
  const look = SCENERY[appearance];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return canvas;
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const water = look.water.map(packColor);
  const sand = look.sand.map(packColor);
  const surface = packColor(look.surface);
  const waterHeight = height - AQUARIUM_SAND;
  for (let y = 0; y < height; y++) {
    const band = (y / waterHeight) * water.length;
    const row = Math.floor(band);
    const blend = band - row > 0.72 && row < water.length - 1;
    for (let x = 0; x < width; x++) {
      const checker = (x + y) % 2 === 0;
      const speck = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      pixels[y * width + x] =
        y === 0 && checker
          ? surface
          : y < waterHeight
            ? water[blend && checker ? row + 1 : row]!
            : y === waterHeight && !checker
              ? water[water.length - 1]!
              : speck % 11 === 0
                ? sand[1]!
                : speck % 13 === 0
                  ? sand[2]!
                  : sand[0]!;
    }
  }
  context.putImageData(image, 0, 0);
  const rayLength = waterHeight * 0.8;
  for (const ray of RAYS) {
    for (let y = 1; y < rayLength; y++) {
      context.fillStyle = `rgba(${look.ray},${look.rayAlpha * (1 - y / rayLength)})`;
      context.fillRect(Math.round(width * ray.at + y * 0.35), y, ray.width, 1);
    }
  }
  for (const rock of ROCKS) {
    const radius = rock.width / 2;
    for (let dy = -rock.height; dy <= 0; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if ((dx / radius) ** 2 + (dy / rock.height) ** 2 > 1) continue;
        context.fillStyle = look.rock[dx < 0 && dy < -rock.height / 2 ? 1 : 0];
        context.fillRect(Math.round(width * rock.at + dx), waterHeight + dy, 1, 1);
      }
    }
  }
  return canvas;
}

function colorsOf(projectKey: string) {
  return FISH_COLORS[aquariumHash(projectKey) % FISH_COLORS.length]!;
}

function paintGlyph(
  context: CanvasRenderingContext2D,
  glyph: ReadonlyArray<string>,
  left: number,
  top: number,
) {
  glyph.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] === "#") context.fillRect(left + x, top + y, 1, 1);
  });
}

function paintPearl(context: CanvasRenderingContext2D, projectKey: string, x: number, y: number) {
  const colors = colorsOf(projectKey);
  context.fillStyle = colors.x;
  context.fillRect(x, y, 2, 2);
  context.fillStyle = colors.o;
  context.fillRect(x, y, 1, 1);
}

function paintSprite(
  context: CanvasRenderingContext2D,
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
      context.fillStyle = color;
      context.fillRect(dir === 1 ? left + x : left + width - 1 - x, top + y, 1, 1);
    }
  });
}

function paintCue(context: CanvasRenderingContext2D, cue: AgentCue, left: number, top: number) {
  if (cue === "working") return;
  const { color, glyph } = CUE_BUBBLES[cue];
  context.fillStyle = color;
  context.fillRect(left + 1, top, 9, 9);
  context.fillRect(left, top + 1, 11, 7);
  context.fillRect(left + 4, top + 9, 3, 1);
  context.fillRect(left + 5, top + 10, 1, 1);
  context.fillStyle = "#1a1206";
  paintGlyph(context, glyph, left + 2, top + 2);
}

export function fishBob(key: string, tick: number) {
  const { phase, species } = fishTraits(key);
  const { stroke, bob } = SPECIES[species];
  return Math.round(Math.sin(((tick + phase) * Math.PI) / (stroke * 5)) * bob);
}

function paintFish(
  context: CanvasRenderingContext2D,
  fish: AquariumFish,
  resident: AquariumResident | undefined,
  tick: number,
  eye: string,
) {
  const traits = fishTraits(fish.key);
  const look = SPECIES[traits.species];
  const { frames, stroke } = look;
  const colors = colorsOf(resident?.projectKey ?? fish.key);
  const palette: Readonly<Record<string, string>> = {
    x: colors.x,
    o: colors.o,
    f: colors.f,
    e: eye,
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
  context.globalAlpha = traits.depth;
  paintSprite(context, rows, palette, left, top, fish.dir);
  if (savoring) {
    context.globalAlpha = 1 - sinceMeal / AFTER_MEAL;
    context.fillStyle = colors.x;
    paintGlyph(
      context,
      HEART,
      left + Math.round(width / 2) - 1,
      top - 4 - Math.floor(sinceMeal / 2),
    );
  }
  context.globalAlpha = 1;
  if (resident !== undefined)
    paintCue(context, resident.cue, left + Math.round(width / 2) - 5, top - CUE_RISE);
}

export function paintFishSprite(
  fish: AquariumFish,
  resident: AquariumResident,
  tick: number,
  appearance: AquariumAppearance,
) {
  const { width, height } = fishSize(fish.key);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context !== null)
    paintFish(
      context,
      { ...fish, x: 0, y: -fishBob(fish.key, tick) },
      resident,
      tick,
      SCENERY[appearance].eye,
    );
  return canvas;
}

export function paintAquarium(
  context: CanvasRenderingContext2D,
  input: {
    readonly aquarium: Aquarium;
    readonly scenery: HTMLCanvasElement;
    readonly residents: ReadonlyMap<string, AquariumResident>;
    readonly tick: number;
    readonly appearance: AquariumAppearance;
    readonly stash: AquariumStash | null;
  },
) {
  const { aquarium, tick } = input;
  const look = SCENERY[input.appearance];
  context.drawImage(input.scenery, 0, 0);
  const floor = aquarium.height - AQUARIUM_SAND - 1;
  for (const weed of aquariumWeeds(aquarium.width)) {
    for (let step = 0; step < weed.height; step++) {
      const sway = Math.sin(tick * 0.13 + step * 0.28 + weed.phase) * (step / weed.height) * 1.6;
      const x = weed.x + Math.round(sway);
      context.fillStyle = look.weed[step % 3 === 0 ? 0 : 1];
      context.fillRect(x, floor - step, 1, 1);
      if (step % 4 === 2) context.fillRect(x + (step % 8 === 2 ? 1 : -1), floor - step, 1, 1);
    }
  }
  context.fillStyle = look.bubble;
  for (const bubble of aquarium.bubbles) {
    if (!bubble.big) {
      context.fillRect(bubble.x, bubble.y, 1, 1);
      continue;
    }
    context.fillRect(bubble.x, bubble.y - 1, 1, 1);
    context.fillRect(bubble.x - 1, bubble.y, 1, 1);
    context.fillRect(bubble.x + 1, bubble.y, 1, 1);
    context.fillRect(bubble.x, bubble.y + 1, 1, 1);
  }
  for (const pearl of aquarium.pearls) paintPearl(context, pearl.projectKey, pearl.x, pearl.y);
  context.fillStyle = look.pellet;
  for (const pellet of aquarium.pellets)
    context.fillRect(Math.round(pellet.x), Math.round(pellet.y), 1, 1);
  const byDepth = aquarium.fish.toSorted(
    (left, right) => fishTraits(left.key).depth - fishTraits(right.key).depth,
  );
  for (const fish of byDepth)
    paintFish(context, fish, input.residents.get(fish.key), tick, look.eye);
  const { pet, ripple, width } = aquarium;
  if (pet !== null) {
    const { frames, stroke } = PETS[pet.kind];
    paintSprite(
      context,
      frames[Math.floor(tick / stroke) % frames.length]!,
      { ...PET_COLORS[pet.kind], e: look.eye },
      Math.round(pet.x),
      Math.round(pet.y),
      pet.dir,
    );
  }
  if (ripple !== null) {
    const radius = 1 + Math.floor(ripple.age / 2);
    context.fillStyle = look.bubble;
    for (let dx = -radius; dx <= radius; dx++) {
      const dy = radius - Math.abs(dx);
      context.fillRect(ripple.x + dx, ripple.y + dy, 1, 1);
      if (dy !== 0) context.fillRect(ripple.x + dx, ripple.y - dy, 1, 1);
    }
  }
  if (input.stash === null) return;
  context.fillStyle = look.pellet;
  for (let dot = 0; dot < Math.floor(input.stash.food); dot++)
    context.fillRect(width - 3 - dot * 2, 2, 1, 1);
  input.stash.strand
    .slice(-Math.floor(width / 8))
    .forEach((projectKey, index) => paintPearl(context, projectKey, 2 + index * 3, 2));
}
