import { aquariumAgents } from "@supacode/client-runtime/aquarium/agents";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "../../state/threads";
import { resolveThreadListV2Status, threadHasUnseenCompletion } from "../threads/threadListV2";

export const aquariumAgentsAtom = Atom.make((get) =>
  aquariumAgents({
    threads: get(environmentThreadShells.navigationThreadShellsAtom),
    status: resolveThreadListV2Status,
    unseen: threadHasUnseenCompletion,
    now: new Date().toISOString(),
  }),
);
