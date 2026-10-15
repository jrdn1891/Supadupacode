import { scopedThreadKey, scopeThreadRef } from "../environment/index.ts";
import type { EnvironmentThreadShell } from "../state/models.ts";
import { effectiveSnoozed } from "../state/threadSettled.ts";
import {
  formatWorkingDurationLabel,
  resolveThreadListDurationStartedAt,
} from "../state/threadTiming.ts";

export type AgentCue = "approval" | "input" | "failed" | "limited" | "ready" | "working";

export type AgentThreadStatus = AgentCue | "waiting";

export interface AquariumAgent {
  readonly key: string;
  readonly thread: EnvironmentThreadShell;
  readonly cue: AgentCue;
}

const CUE_ORDER: Readonly<Record<AgentCue, number>> = {
  approval: 0,
  input: 0,
  failed: 0,
  limited: 0,
  ready: 1,
  working: 2,
};

export function agentCue(input: {
  readonly status: AgentThreadStatus;
  readonly thread: Pick<EnvironmentThreadShell, "latestRun">;
  readonly unseen: boolean;
}): AgentCue | null {
  const { status } = input;
  if (status === "approval" || status === "input" || status === "failed" || status === "limited")
    return status;
  if (status === "ready" && input.thread.latestRun?.status === "failed") return "failed";
  if (status === "working" || status === "waiting") return "working";
  return input.unseen ? "ready" : null;
}

export function aquariumAgents(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly status: (thread: EnvironmentThreadShell) => AgentThreadStatus;
  readonly unseen: (thread: EnvironmentThreadShell, key: string) => boolean;
  readonly now: string;
}): ReadonlyArray<AquariumAgent> {
  const agents: AquariumAgent[] = [];
  for (const thread of input.threads) {
    if (
      thread.archivedAt !== null ||
      thread.settledOverride === "settled" ||
      thread.lineage.relationshipToParent === "subagent" ||
      effectiveSnoozed(thread, { now: input.now })
    )
      continue;
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const cue = agentCue({
      status: input.status(thread),
      thread,
      unseen: input.unseen(thread, key),
    });
    if (cue !== null) agents.push({ key, thread, cue });
  }
  return agents.sort(
    (left, right) =>
      CUE_ORDER[left.cue] - CUE_ORDER[right.cue] ||
      right.thread.updatedAt.localeCompare(left.thread.updatedAt),
  );
}

/** The last messages the user and agent exchanged, oldest first, for a creature's chat. */
export function chatTail<Message extends { readonly role: string; readonly text: string }>(
  messages: ReadonlyArray<Message>,
  limit: number,
): ReadonlyArray<Message> {
  const tail: Message[] = [];
  for (let index = messages.length - 1; index >= 0 && tail.length < limit; index--) {
    const message = messages[index]!;
    if (message.role !== "system" && message.text.trim() !== "") tail.unshift(message);
  }
  return tail;
}

export function agentCueDetail(
  thread: EnvironmentThreadShell,
  cue: AgentCue,
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

export function aquariumCaption(
  agents: ReadonlyArray<AquariumAgent>,
  nowMs: number,
): string | null {
  if (agents.length === 0) return null;
  const featured = agents.find((agent) => agent.cue !== "working");
  return featured === undefined
    ? `${agents.length} ${agents.length === 1 ? "agent" : "agents"} working · nothing needs you`
    : `${featured.thread.title} · ${agentCueDetail(featured.thread, featured.cue, nowMs)}`;
}
