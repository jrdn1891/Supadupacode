import type { AgentCue } from "./aquariumAgents";

import {
  AQUARIUM_SAND,
  type Aquarium,
  type AquariumFish,
  type AquariumResident,
  aquariumHash,
  aquariumWeeds,
  FISH_SPRITES,
  fishTraits,
} from "./aquarium.logic";

export type AquariumAppearance = "light" | "dark";

export const CUE_RISE = 13;

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

const EXCLAIM = ["...#...", "...#...", "...#...", ".......", "...#..."];
const QUESTION = ["..###..", "....#..", "...#...", ".......", "...#..."];
const CHECK = ["......#", ".....#.", "#...#..", ".#.#...", "..#...."];

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

function paintCue(context: CanvasRenderingContext2D, cue: AgentCue, left: number, top: number) {
  if (cue === "working") return;
  const { color, glyph } = CUE_BUBBLES[cue];
  context.fillStyle = color;
  context.fillRect(left + 1, top, 9, 9);
  context.fillRect(left, top + 1, 11, 7);
  context.fillRect(left + 4, top + 9, 3, 1);
  context.fillRect(left + 5, top + 10, 1, 1);
  context.fillStyle = "#1a1206";
  glyph.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] === "#") context.fillRect(left + 2 + x, top + 2 + y, 1, 1);
  });
}

function paintFish(
  context: CanvasRenderingContext2D,
  fish: AquariumFish,
  resident: AquariumResident | undefined,
  tick: number,
  eye: string,
) {
  const traits = fishTraits(fish.key);
  const sprite = FISH_SPRITES[traits.kind];
  const colors = FISH_COLORS[aquariumHash(resident?.projectKey ?? fish.key) % FISH_COLORS.length]!;
  const palette: Readonly<Record<string, string>> = {
    x: colors.x,
    o: colors.o,
    f: colors.f,
    t: colors.f,
    e: eye,
  };
  const tail = sprite.tails[Math.floor((tick + traits.phase) / 3) % 2]!;
  const width = sprite.rows[0].length;
  const left = Math.round(fish.x);
  const top = Math.round(fish.y) + Math.round(Math.sin((tick + traits.phase) * 0.22));
  context.globalAlpha = traits.depth;
  sprite.rows.forEach((row, y) => {
    const tailRow = tail[y - sprite.tailRow];
    for (let x = 0; x < width; x++) {
      const pixel = x < 2 && tailRow?.[x] === "t" ? "t" : row[x];
      const color = pixel === undefined ? undefined : palette[pixel];
      if (color === undefined) continue;
      context.fillStyle = color;
      context.fillRect(fish.dir === 1 ? left + x : left + width - 1 - x, top + y, 1, 1);
    }
  });
  context.globalAlpha = 1;
  if (resident !== undefined)
    paintCue(context, resident.cue, left + Math.round(width / 2) - 5, top - CUE_RISE);
}

export function paintAquarium(
  context: CanvasRenderingContext2D,
  input: {
    readonly aquarium: Aquarium;
    readonly scenery: HTMLCanvasElement;
    readonly residents: ReadonlyMap<string, AquariumResident>;
    readonly tick: number;
    readonly appearance: AquariumAppearance;
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
  const byDepth = aquarium.fish.toSorted(
    (left, right) => fishTraits(left.key).depth - fishTraits(right.key).depth,
  );
  for (const fish of byDepth)
    paintFish(context, fish, input.residents.get(fish.key), tick, look.eye);
}
