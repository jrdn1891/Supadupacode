import type { AgentCue, AquariumAgent } from "@supacode/client-runtime/aquarium/agents";

export function arrivedCue(
  previous: ReadonlyMap<string, AgentCue> | null,
  agents: ReadonlyArray<AquariumAgent>,
  onScreenKey: string | null,
): AgentCue | null {
  if (previous === null) return null;
  const arrived = agents.find(
    (agent) =>
      agent.cue !== "working" &&
      agent.key !== onScreenKey &&
      previous.has(agent.key) &&
      previous.get(agent.key) !== agent.cue,
  );
  return arrived?.cue ?? null;
}
