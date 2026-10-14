import { presentThreadShell } from "@supacode/client-runtime/state/models";
import {
  type EnvironmentId,
  type OrchestrationV2ThreadShell,
  ProjectId,
  ProviderInstanceId,
  RunId,
  ThreadId,
} from "@supacode/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { backstageEntries } from "./backstage.logic";

const now = DateTime.makeUnsafe("2026-10-14T12:00:00.000Z");
const environmentId = "env" as EnvironmentId;
const provider = ProviderInstanceId.make("codex");

function shell(id: string, overrides: Partial<OrchestrationV2ThreadShell> = {}) {
  const threadId = ThreadId.make(id);
  return presentThreadShell(environmentId, {
    id: threadId,
    projectId: ProjectId.make("project"),
    title: id,
    providerInstanceId: provider,
    modelSelection: { instanceId: provider, model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    activeProviderThreadId: null,
    lineage: { rootThreadId: threadId, parentThreadId: null, relationshipToParent: null },
    forkedFrom: null,
    createdBy: "user",
    creationSource: "web",
    latestRunId: null,
    activeRunId: null,
    status: "idle",
    pendingRuntimeRequest: null,
    latestVisibleMessage: null,
    latestUserMessageAt: null,
    hasActionableProposedPlan: false,
    itemCount: 0,
    visibleItemCount: 0,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    lastVisitedAt: null,
    deletedAt: null,
    ...overrides,
  });
}

const running = (progress: OrchestrationV2ThreadShell["progress"] = null) => ({
  latestRunId: RunId.make("run"),
  activeRunId: RunId.make("run"),
  status: "running" as const,
  activityRunStatus: "running" as const,
  activityRunStartedAt: now,
  latestRunRequestedAt: now,
  latestRunStartedAt: now,
  progress,
});

const cues = (threads: ReturnType<typeof shell>[], stage: string[] = []) =>
  backstageEntries({
    threads,
    stageKeys: new Set(stage.map((id) => `${environmentId}:${id}`)),
    lastVisitedAt: () => "2026-10-14T11:00:00.000Z",
    now: "2026-10-14T12:00:00.000Z",
  }).map((entry) => [entry.thread.title, entry.cue]);

describe("backstageEntries", () => {
  it("lists running work off stage, with the last step as standby", () => {
    expect(
      cues(
        [
          shell("plain", running()),
          shell("last-step", running({ done: 2, total: 3, current: "Ship" })),
          shell("idle"),
        ],
        [],
      ),
    ).toEqual([
      ["last-step", "standby"],
      ["plain", "working"],
    ]);
  });

  it("puts threads that need the user first and leaves on-stage threads out", () => {
    expect(
      cues(
        [
          shell("working", running()),
          shell("asking", {
            ...running(),
            pendingRuntimeRequest: {
              id: "request" as never,
              kind: "user_input",
              createdAt: now,
            },
          }),
          shell("watched", running()),
        ],
        ["watched"],
      ),
    ).toEqual([
      ["asking", "needs-you"],
      ["working", "working"],
    ]);
  });

  it("keeps parked, settled, and subagent threads off the bar", () => {
    expect(
      cues([
        shell("parked", { ...running(), snoozedAt: now, snoozedUntil: null }),
        shell("settled", { ...running(), settledOverride: "settled", settledAt: now }),
        shell("subagent", {
          ...running(),
          lineage: {
            rootThreadId: ThreadId.make("root"),
            parentThreadId: ThreadId.make("root"),
            relationshipToParent: "subagent",
          },
        }),
      ]),
    ).toEqual([]);
  });

  it("shows a finished thread as ready until it is seen", () => {
    const finished = shell("finished", {
      latestRunId: RunId.make("run"),
      status: "completed",
      latestRunRequestedAt: now,
      latestRunStartedAt: now,
      latestRunCompletedAt: now,
    });
    expect(cues([finished])).toEqual([["finished", "ready"]]);
    expect(
      backstageEntries({
        threads: [finished],
        stageKeys: new Set(),
        lastVisitedAt: () => "2026-10-14T12:30:00.000Z",
        now: "2026-10-14T13:00:00.000Z",
      }),
    ).toEqual([]);
  });
});
