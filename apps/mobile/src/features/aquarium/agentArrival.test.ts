import type { AgentCue, AquariumAgent } from "@supacode/client-runtime/aquarium/agents";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadShellFixture } from "../../test-fixtures";
import { arrivedCue } from "./agentArrival";

const agent = (key: string, cue: AgentCue): AquariumAgent => ({
  key,
  thread: makeThreadShellFixture(),
  cue,
});
const seen = (entries: Record<string, AgentCue>) => new Map(Object.entries(entries));

describe("arrivedCue", () => {
  it("stays silent on the first observation", () => {
    expect(arrivedCue(null, [agent("a", "approval")], null)).toBeNull();
  });

  it("announces a known agent that stops working to need the user", () => {
    expect(arrivedCue(seen({ a: "working" }), [agent("a", "ready")], null)).toBe("ready");
    expect(arrivedCue(seen({ a: "working" }), [agent("a", "approval")], null)).toBe("approval");
  });

  it("ignores agents it never saw working, such as a list loading after a reconnect", () => {
    expect(arrivedCue(seen({}), [agent("a", "approval")], null)).toBeNull();
  });

  it("leaves the thread on screen to its own feedback", () => {
    expect(arrivedCue(seen({ a: "working" }), [agent("a", "input")], "a")).toBeNull();
  });

  it("does not repeat a cue that has not changed", () => {
    expect(arrivedCue(seen({ a: "approval" }), [agent("a", "approval")], null)).toBeNull();
  });
});
