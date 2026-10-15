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

export type BackstageCue = "needs-you" | "ready" | "standby" | "working";

export interface BackstageEntry {
  readonly key: string;
  readonly thread: EnvironmentThreadShell;
  readonly cue: BackstageCue;
}

const CUE_ORDER: Readonly<Record<BackstageCue, number>> = {
  "needs-you": 0,
  ready: 1,
  standby: 2,
  working: 3,
};

export function backstageCue(input: {
  readonly status: BackstageThreadStatus;
  readonly thread: Pick<EnvironmentThreadShell, "latestRun" | "progress">;
  readonly unseen: boolean;
}): BackstageCue | null {
  const { status, thread } = input;
  if (
    status === "approval" ||
    status === "input" ||
    status === "failed" ||
    status === "limited" ||
    (status === "ready" && thread.latestRun?.status === "failed")
  ) {
    return "needs-you";
  }
  if (status === "working" || status === "waiting") {
    const progress = thread.progress;
    return progress !== null && progress.total > 1 && progress.total - progress.done === 1
      ? "standby"
      : "working";
  }
  return input.unseen ? "ready" : null;
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
    case "needs-you":
      return thread.hasPendingApprovals
        ? "Needs approval"
        : thread.hasPendingUserInput
          ? "Has a question"
          : thread.runtime?.lastErrorClass === "usage_limit"
            ? "Usage limit"
            : "Failed";
    case "ready":
      return "Ready";
    case "standby":
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
