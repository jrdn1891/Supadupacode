import type { AgentCue } from "./agents.ts";

type Diet = "chase" | "dart" | "snap" | "absorb" | "graze" | "crawl";

interface SpeciesLook {
  readonly speed: number;
  readonly stroke: number;
  readonly bob: number;
  readonly diet: Diet;
  readonly frames: ReadonlyArray<ReadonlyArray<string>>;
  readonly puffed?: ReadonlyArray<string>;
}

export const SPECIES = {
  fish: {
    speed: 0.45,
    stroke: 3,
    bob: 1,
    diet: "chase",
    frames: [
      [
        "......ff....",
        "f...xxxxx...",
        "ff.xxxxxxxx.",
        ".fxxxxxxxexx",
        ".fxxxxxxxxxx",
        "ff.oooooooo.",
        "f...ooooo...",
        "......f.....",
      ],
      [
        "......ff....",
        ".f..xxxxx...",
        ".f.xxxxxxxx.",
        "ffxxxxxxxexx",
        "ffxxxxxxxxxx",
        ".f.oooooooo.",
        ".f..ooooo...",
        "......f.....",
      ],
    ],
  },
  minnow: {
    speed: 0.55,
    stroke: 2,
    bob: 1,
    diet: "dart",
    frames: [
      ["f..xxx..", ".fxxxxex", ".foooooo", "f..ooo.."],
      [".f.xxx..", "ffxxxxex", "ffoooooo", ".f.ooo.."],
    ],
  },
  angelfish: {
    speed: 0.3,
    stroke: 4,
    bob: 1,
    diet: "chase",
    frames: [
      [
        "..f........",
        "..ff.......",
        "...fff.....",
        "....xxfx...",
        "...fxxfxx..",
        "f.xfxxfxxx.",
        "ffxfxxfxxex",
        "f.ofoofooo.",
        "...foofoo..",
        "....oofo...",
        "...fff.....",
        "..ff.......",
        "..f........",
      ],
      [
        "..f........",
        "..ff.......",
        "...fff.....",
        "....xxfx...",
        "...fxxfxx..",
        ".fxfxxfxxx.",
        ".fxfxxfxxex",
        ".fofoofooo.",
        "...foofoo..",
        "....oofo...",
        "...fff.....",
        "..ff.......",
        "..f........",
      ],
    ],
  },
  puffer: {
    speed: 0.22,
    stroke: 3,
    bob: 1,
    diet: "chase",
    frames: [
      [
        ".....f.f...",
        "...f.xxx.f.",
        "....xxxxxx.",
        "f..xxxxxxex",
        "ffxxxxxxxxx",
        "f..ooooooox",
        "....oooooo.",
        "...f.ooo.f.",
        ".....f.f...",
      ],
      [
        ".....f.f...",
        "...f.xxx.f.",
        "....xxxxxx.",
        ".f.xxxxxxex",
        ".fxxxxxxxxx",
        ".f.ooooooox",
        "....oooooo.",
        "...f.ooo.f.",
        ".....f.f...",
      ],
    ],
    puffed: [
      ".....f.f.f...",
      "...f..xxx..f.",
      "....xxxxxxx..",
      "...xxxxxxxxxf",
      "f..xxxxxxexx.",
      "ffxxxxxxxxxx.",
      "f..ooooooooo.",
      "...ooooooooof",
      "....ooooooo..",
      "...f..ooo..f.",
      ".....f.f.f...",
    ],
  },
  dolphin: {
    speed: 0.6,
    stroke: 3,
    bob: 2,
    diet: "dart",
    frames: [
      [
        "......ff..........",
        ".......fff........",
        "ff....xxxxxxxx....",
        ".fxxxxxxxxxxxxx...",
        "..xxxxxxxxxxxexx..",
        "...ooooooooooooxxx",
        "......oooofooo....",
        ".........f........",
      ],
      [
        "......ff..........",
        ".......fff........",
        "......xxxxxxxx....",
        "..xxxxxxxxxxxxx...",
        ".fxxxxxxxxxxxexx..",
        "ff.ooooooooooooxxx",
        "......oooofooo....",
        ".........f........",
      ],
    ],
  },
  jellyfish: {
    speed: 0.12,
    stroke: 5,
    bob: 2,
    diet: "absorb",
    frames: [
      [
        "...xxx...",
        ".xxxxxxx.",
        "xooxxxxxx",
        "xoxxxxxxx",
        "xxxxxxxxx",
        "o.oo.oo.o",
        ".o..o..o.",
        "o...o...o",
        "o....o..o",
        ".o...o.o.",
        ".o..o....",
      ],
      [
        "...xxx...",
        ".xxxxxxx.",
        "xooxxxxxx",
        "xoxxxxxxx",
        "xxxxxxxxx",
        "o.oo.oo.o",
        ".o..o..o.",
        ".o.o...o.",
        "..o.o.o..",
        "..o..o..o",
        "...o....o",
      ],
    ],
  },
  turtle: {
    speed: 0.18,
    stroke: 5,
    bob: 1,
    diet: "graze",
    frames: [
      [
        "......xxxxx......",
        "...xxfxxxfxx.....",
        "..xfxxxfxxxfx.oo.",
        ".xxxxfxxxfxxxxoeo",
        "offfffffffffffoo.",
        "..oo.......oo....",
        ".oo.........oo...",
      ],
      [
        "......xxxxx......",
        "...xxfxxxfxx.....",
        "..xfxxxfxxxfx.oo.",
        ".xxxxfxxxfxxxxoeo",
        "offfffffffffffoo.",
        "...oo.....oo.....",
        "....oo...oo......",
      ],
    ],
  },
  seahorse: {
    speed: 0.12,
    stroke: 2,
    bob: 2,
    diet: "snap",
    frames: [
      [
        "...xf...",
        "..xxxx..",
        "..xexxxx",
        "..xxx...",
        "...xx...",
        "..fxxo..",
        ".ffxxoo.",
        "..fxxoo.",
        "...xxo..",
        "...xx...",
        "....x...",
        "..x.x...",
        "...xx...",
      ],
      [
        "...xf...",
        "..xxxx..",
        "..xexxxx",
        "..xxx...",
        "...xx...",
        "...xxo..",
        "..fxxoo.",
        "...xxoo.",
        "...xxo..",
        "...xx...",
        "....x...",
        "..x.x...",
        "...xx...",
      ],
    ],
  },
  starfish: {
    speed: 0.06,
    stroke: 8,
    bob: 0,
    diet: "crawl",
    frames: [
      [
        "....x....",
        "...xfx...",
        "xxxxoxxxx",
        ".xfooofx.",
        "..xxoxx..",
        "..xx.xx..",
        ".xf...fx.",
        ".x.....x.",
      ],
      [
        "....x....",
        "...xfx...",
        ".xxxoxxx.",
        "xxfooofxx",
        "..xxoxx..",
        "..xx.xx..",
        "..xf.fx..",
        "..x...x..",
      ],
    ],
  },
  crab: {
    speed: 0.15,
    stroke: 2,
    bob: 0,
    diet: "crawl",
    frames: [
      [
        ".ff.......ff.",
        "f..f.....f..f",
        ".ff.......ff.",
        "...f.....f...",
        "..xxexxxexx..",
        ".xxxxxxxxxxx.",
        "..ooooooooo..",
        "f.f.f...f.f.f",
      ],
      [
        ".ff.......ff.",
        "fff.......fff",
        ".ff.......ff.",
        "...f.....f...",
        "..xxexxxexx..",
        ".xxxxxxxxxxx.",
        "..ooooooooo..",
        ".f.f.f.f.f.f.",
      ],
    ],
  },
} as const satisfies Record<string, SpeciesLook>;

export type Species = keyof typeof SPECIES;

const SPECIES_NAMES = Object.keys(SPECIES) as ReadonlyArray<Species>;

export function aquariumHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function fishSpecies(key: string): Species {
  return SPECIES_NAMES[aquariumHash(key) % SPECIES_NAMES.length]!;
}

const FISH_COLORS = [
  { x: "#d9965a", o: "#ecc08f", f: "#b4733c" },
  { x: "#5e9fc7", o: "#9ccbe4", f: "#3f7aa3" },
  { x: "#c97d93", o: "#e6adbd", f: "#a35d72" },
  { x: "#7cc4a0", o: "#b9e3cc", f: "#57a07d" },
  { x: "#a99ad8", o: "#cfc5ee", f: "#8676b8" },
  { x: "#d6b85a", o: "#ecd895", f: "#b0953c" },
] as const;

export function fishColors(projectKey: string) {
  return FISH_COLORS[aquariumHash(projectKey) % FISH_COLORS.length]!;
}

const EXCLAIM = ["...#...", "...#...", "...#...", ".......", "...#..."];
const QUESTION = ["..###..", "....#..", "...#...", ".......", "...#..."];
const CHECK = ["......#", ".....#.", "#...#..", ".#.#...", "..#...."];

const CUE_BUBBLE = [
  ".bbbbbbbbb.",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  "bbbbbbbbbbb",
  ".bbbbbbbbb.",
  "....bbb....",
  ".....b.....",
];

const CUE_MARKS: Readonly<
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

export function cueMark(cue: Exclude<AgentCue, "working">) {
  const { color, glyph } = CUE_MARKS[cue];
  return {
    rows: CUE_BUBBLE.map((row, y) =>
      Array.from(row, (pixel, x) => (glyph[y - 2]?.[x - 2] === "#" ? "g" : pixel)).join(""),
    ),
    palette: { b: color, g: "#1a1206" },
  };
}
