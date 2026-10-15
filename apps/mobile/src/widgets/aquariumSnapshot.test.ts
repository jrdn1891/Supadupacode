import type { AgentCue, AquariumAgent } from "@supacode/client-runtime/aquarium/agents";
import { ProjectId, ThreadId } from "@supacode/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadShellFixture } from "../test-fixtures";
import { buildAquariumSnapshot } from "./aquariumSnapshot";

const agent = (id: string, cue: AgentCue): AquariumAgent => ({
  key: `environment-test:${id}`,
  thread: makeThreadShellFixture({
    id: ThreadId.make(id),
    projectId: ProjectId.make("project"),
    title: id,
  }),
  cue,
});

const snapshot = (agents: ReadonlyArray<AquariumAgent>) =>
  buildAquariumSnapshot({
    agents,
    nowMs: 0,
    homeUrl: "supacode://",
    threadUrl: (featured) => `supacode://threads/${featured.thread.id}`,
  });

describe("buildAquariumSnapshot", () => {
  it("says all is quiet and opens the app when no agent is in the tank", () => {
    expect(snapshot([])).toEqual({
      url: "supacode://",
      caption: "All quiet",
      working: 0,
      needsYou: 0,
      fish: [],
    });
  });

  it("opens the thread that needs the user and marks only its fish", () => {
    const result = snapshot([agent("Ship it", "approval"), agent("busy", "working")]);
    expect(result).toMatchObject({
      url: "supacode://threads/Ship it",
      caption: "Ship it · Needs approval",
      working: 1,
      needsYou: 1,
    });
    expect(result.fish.map((fish) => fish.mark !== null)).toEqual([true, false]);
  });

  it("keeps the same creature for a thread across snapshots", () => {
    const first = snapshot([agent("a", "working")]).fish[0];
    expect(snapshot([agent("a", "ready"), agent("b", "working")]).fish[0]?.body).toEqual(
      first?.body,
    );
  });

  it("draws at most eight fish but counts every agent", () => {
    const result = snapshot(Array.from({ length: 10 }, (_, index) => agent(`${index}`, "working")));
    expect(result.fish).toHaveLength(8);
    expect(result.working).toBe(10);
  });
});
