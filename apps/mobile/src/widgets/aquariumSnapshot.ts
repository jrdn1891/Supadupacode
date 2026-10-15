import { type AquariumAgent, aquariumCaption } from "@supacode/client-runtime/aquarium/agents";
import { aquariumHash } from "@supacode/client-runtime/aquarium/creatures";

import { creatureSprite, cueSprite, type Sprite } from "../features/aquarium/sprites";

const FISH_LIMIT = 8;

export interface AquariumWidgetFish {
  readonly key: string;
  readonly body: Sprite;
  readonly mark: Sprite | null;
  readonly lift: number;
}

export interface AquariumSnapshot {
  readonly url: string;
  readonly caption: string;
  readonly working: number;
  readonly needsYou: number;
  readonly fish: ReadonlyArray<AquariumWidgetFish>;
}

export interface AquariumWidgetProps extends AquariumSnapshot {
  readonly updatedAt: number;
}

export function buildAquariumSnapshot(input: {
  readonly agents: ReadonlyArray<AquariumAgent>;
  readonly nowMs: number;
  readonly homeUrl: string;
  readonly threadUrl: (agent: AquariumAgent) => string;
}): AquariumSnapshot {
  const featured = input.agents.find((agent) => agent.cue !== "working");
  const working = input.agents.filter((agent) => agent.cue === "working").length;
  return {
    url: featured === undefined ? input.homeUrl : input.threadUrl(featured),
    caption: aquariumCaption(input.agents, input.nowMs) ?? "All quiet",
    working,
    needsYou: input.agents.length - working,
    fish: input.agents.slice(0, FISH_LIMIT).map((agent) => ({
      key: agent.key,
      body: creatureSprite(agent.key, agent.thread.projectId),
      mark: agent.cue === "working" ? null : cueSprite(agent.cue),
      lift: (aquariumHash(agent.key) >>> 4) % 3,
    })),
  };
}
