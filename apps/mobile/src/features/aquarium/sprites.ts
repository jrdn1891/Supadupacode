import type { AgentCue } from "@supacode/client-runtime/aquarium/agents";
import {
  cueMark,
  fishColors,
  fishSpecies,
  SPECIES,
} from "@supacode/client-runtime/aquarium/creatures";

const EYE = "#0b0f16";

export interface SpriteRun {
  readonly x: number;
  readonly span: number;
  readonly color: string | null;
}

export interface SpriteRow {
  readonly y: number;
  readonly runs: ReadonlyArray<SpriteRun>;
}

export type Sprite = ReadonlyArray<SpriteRow>;

export function spriteRuns(
  rows: ReadonlyArray<string>,
  palette: Readonly<Record<string, string>>,
): Sprite {
  return rows.map((row, y) => ({
    y,
    runs: Array.from(row).reduce<SpriteRun[]>((runs, pixel, x) => {
      const color = palette[pixel] ?? null;
      const last = runs.at(-1);
      if (last?.color === color) runs[runs.length - 1] = { ...last, span: last.span + 1 };
      else runs.push({ x, span: 1, color });
      return runs;
    }, []),
  }));
}

export function creatureSprite(key: string, projectKey: string): Sprite {
  return spriteRuns(SPECIES[fishSpecies(key)].frames[0], { ...fishColors(projectKey), e: EYE });
}

export function cueSprite(cue: Exclude<AgentCue, "working">): Sprite {
  const { rows, palette } = cueMark(cue);
  return spriteRuns(rows, palette);
}
