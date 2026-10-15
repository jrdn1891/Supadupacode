import { aquariumHash } from "@supacode/client-runtime/aquarium/creatures";
import type { Contribution, ContributionListInput } from "@supacode/contracts";

export const CORALS = [
  [
    "..o.....o..",
    ".ox..o..xo.",
    ".x...x...x.",
    ".xx..x..xx.",
    "..x..x..x..",
    "..xx.x.xx..",
    "...xxxxx...",
    "....xxx....",
    "...fffff...",
  ],
  ["...xxxxx...", ".xxoxxxoxx.", "xxoxxoxxoxx", "xoxxoxxoxxx", "xxxoxxoxxox", "fffffffffff"],
  [
    "...o.o.o...",
    ".o.x.x.x.o.",
    ".x.xoxox.x.",
    "o.xoxoxox.o",
    "x.xoxoxox.x",
    ".xoxoxoxox.",
    "..xoxoxox..",
    "...xxxxx...",
    ".....x.....",
    "....fff....",
  ],
  [
    ".o.....o.",
    ".x..o..x.",
    ".x..x..xo",
    "ox..x..xx",
    "xx.ox..xx",
    "xx.xx.xxx",
    "xxxxxxxxx",
    "fffffffff",
  ],
] as const;

export type AquariumPlant =
  | {
      readonly kind: "weed";
      readonly key: string;
      readonly x: number;
      readonly height: number;
      readonly phase: number;
    }
  | {
      readonly kind: "coral";
      readonly key: string;
      readonly x: number;
      readonly form: (typeof CORALS)[number];
      readonly projectKey: string;
    };

export const GROW_TICKS = 30;

export function seabedPlants(
  width: number,
  contributions: ReadonlyArray<Contribution>,
): ReadonlyArray<AquariumPlant> {
  const plants = contributions.map((contribution): AquariumPlant => {
    const hash = aquariumHash(contribution.key);
    const x = Math.round((0.03 + ((hash % 1000) / 1000) * 0.94) * width);
    return contribution.kind === "commit"
      ? {
          kind: "weed",
          key: contribution.key,
          x,
          height: 10 + ((hash >>> 10) % 21),
          phase: ((hash >>> 16) % 63) / 10,
        }
      : {
          kind: "coral",
          key: contribution.key,
          x,
          form: CORALS[(hash >>> 10) % CORALS.length]!,
          projectKey: contribution.projectId,
        };
  });
  return plants.toSorted((left, right) =>
    left.kind === right.kind ? left.x - right.x : left.kind === "weed" ? -1 : 1,
  );
}

export function seabedDay(nowMs: number, daysBack: number): ContributionListInput {
  const now = new Date(nowMs);
  const day = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack + offset).toISOString();
  return { since: day(0), until: day(1) };
}

const counted = (count: number, noun: string) =>
  count === 0 ? [] : [`${count} ${noun}${count === 1 ? "" : "s"}`];

export function seabedTally(contributions: ReadonlyArray<Contribution>) {
  const commits = contributions.filter((contribution) => contribution.kind === "commit").length;
  return [
    ...counted(commits, "commit"),
    ...counted(contributions.length - commits, "pull request"),
  ].join(" · ");
}
