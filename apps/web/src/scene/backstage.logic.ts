import type { EnvironmentThreadShell } from "@supacode/client-runtime/state/models";
import { effectiveSnoozed } from "@supacode/client-runtime/state/thread-settled";
import { scopedThreadKey, scopeThreadRef } from "@supacode/client-runtime/environment";

import { hasUnseenCompletion, resolveSidebarThreadStatus } from "../components/Sidebar.logic";

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

export function backstageCue(
  thread: EnvironmentThreadShell,
  lastVisitedAt: string | undefined,
): BackstageCue | null {
  const status = resolveSidebarThreadStatus(thread);
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
  return hasUnseenCompletion({ ...thread, lastVisitedAt }) ? "ready" : null;
}

export function backstageEntries(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly stageKeys: ReadonlySet<string>;
  readonly lastVisitedAt: (thread: EnvironmentThreadShell, key: string) => string | undefined;
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
    if (input.stageKeys.has(key)) continue;
    const cue = backstageCue(thread, input.lastVisitedAt(thread, key));
    if (cue !== null) entries.push({ key, thread, cue });
  }
  return entries.toSorted(
    (left, right) =>
      CUE_ORDER[left.cue] - CUE_ORDER[right.cue] ||
      right.thread.updatedAt.localeCompare(left.thread.updatedAt),
  );
}
