import type { BackstageCue } from "@supacode/contracts";

import { scopedThreadKey, scopeThreadRef } from "../environment/scoped.ts";
import type { EnvironmentThreadShell } from "./models.ts";
import { effectiveSnoozed } from "./threadSettled.ts";
import { formatWorkingDurationLabel, resolveThreadListDurationStartedAt } from "./threadTiming.ts";

export type BackstageThreadStatus =
  | "approval"
  | "input"
  | "working"
  | "waiting"
  | "failed"
  | "limited"
  | "ready";

export interface BackstageEntry {
  readonly key: string;
  readonly thread: EnvironmentThreadShell;
  readonly cue: BackstageCue;
}

const CUE_ORDER: Readonly<Record<BackstageCue, number>> = {
  approval: 0,
  input: 0,
  failed: 0,
  limited: 0,
  ready: 1,
  working: 2,
};

export function backstageCue(input: {
  readonly status: BackstageThreadStatus;
  readonly thread: Pick<EnvironmentThreadShell, "latestRun">;
  readonly unseen: boolean;
}): BackstageCue | null {
  const { status } = input;
  if (status === "approval" || status === "input" || status === "failed" || status === "limited")
    return status;
  if (status === "ready" && input.thread.latestRun?.status === "failed") return "failed";
  if (status === "working" || status === "waiting") return "working";
  return input.unseen ? "ready" : null;
}

export function awaitsYou(
  thread: Pick<EnvironmentThreadShell, "hasPendingApprovals" | "hasPendingUserInput">,
): boolean {
  return thread.hasPendingApprovals || thread.hasPendingUserInput;
}

export function backstageEntries(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly onStage: (key: string) => boolean;
  readonly status: (thread: EnvironmentThreadShell) => BackstageThreadStatus;
  readonly unseen: (thread: EnvironmentThreadShell, key: string) => boolean;
  readonly now: string;
}): ReadonlyArray<BackstageEntry> {
  const entries: BackstageEntry[] = [];
  for (const thread of input.threads) {
    if (
      thread.archivedAt !== null ||
      thread.settledOverride === "settled" ||
      thread.lineage.relationshipToParent === "subagent" ||
      effectiveSnoozed(thread, { now: input.now })
    )
      continue;
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    if (input.onStage(key)) continue;
    const cue = backstageCue({
      status: input.status(thread),
      thread,
      unseen: input.unseen(thread, key),
    });
    if (cue !== null) entries.push({ key, thread, cue });
  }
  return entries.sort(
    (left, right) =>
      CUE_ORDER[left.cue] - CUE_ORDER[right.cue] ||
      right.thread.updatedAt.localeCompare(left.thread.updatedAt),
  );
}

export function backstageDetail(
  thread: EnvironmentThreadShell,
  cue: BackstageCue,
  nowMs: number,
): string | null {
  switch (cue) {
    case "approval":
      return "Needs approval";
    case "input":
      return "Has a question";
    case "limited":
      return "Usage limit";
    case "failed":
      return "Failed";
    case "ready":
      return "Done";
    case "working": {
      const progress = thread.progress;
      if (progress !== null) return `${progress.done}/${progress.total}`;
      const startedAt = resolveThreadListDurationStartedAt(thread);
      if (startedAt === null) return null;
      const elapsedMs = nowMs - Date.parse(startedAt);
      return elapsedMs < 60_000 ? "<1m" : formatWorkingDurationLabel(elapsedMs);
    }
  }
}
