import { useAtomValue } from "@effect/atom-react";
import type { AgentCue } from "@supacode/client-runtime/aquarium/agents";
import { Atom } from "effect/reactivity";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { environmentCatalog } from "../../connection/catalog";
import { onScreenThreadKey } from "../../lib/navigationRef";
import { buildAquariumSnapshot } from "../../widgets/aquariumSnapshot";
import { publishAquarium } from "../../widgets/publishAquarium";
import { arrivedCue } from "./agentArrival";
import { aquariumAgentsAtom } from "./agents";

const snapshotAtom = Atom.make((get) =>
  buildAquariumSnapshot({
    agents: get(aquariumAgentsAtom),
    nowMs: Date.now(),
    homeUrl: Linking.createURL("/"),
    threadUrl: (agent) =>
      Linking.createURL(`threads/${agent.thread.environmentId}/${agent.thread.id}`),
  }),
).pipe(Atom.withEquality((a, b) => JSON.stringify(a) === JSON.stringify(b)));

export function AquariumCoordinator() {
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const agents = useAtomValue(aquariumAgentsAtom);
  const snapshot = useAtomValue(snapshotAtom);
  const previous = useRef<ReadonlyMap<string, AgentCue> | null>(null);

  useEffect(() => {
    const cue = arrivedCue(previous.current, agents, onScreenThreadKey());
    previous.current = new Map(agents.map((agent) => [agent.key, agent.cue]));
    if (cue === null) return;
    void Haptics.notificationAsync(
      cue === "ready"
        ? Haptics.NotificationFeedbackType.Success
        : cue === "failed"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning,
    );
  }, [agents]);

  useEffect(() => {
    if (!catalog.isReady) return;
    const publish = () =>
      void Promise.resolve()
        .then(() => publishAquarium({ ...snapshot, updatedAt: Date.now() }))
        .catch((error: unknown) => {
          console.warn("Could not update aquarium widget", error);
        });
    publish();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") publish();
    });
    return () => subscription.remove();
  }, [catalog.isReady, snapshot]);

  return null;
}
