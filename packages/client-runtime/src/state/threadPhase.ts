import type { OrchestrationV2ThreadPhase } from "@supacode/contracts";

export const THREAD_PHASE_LABELS: Readonly<Record<OrchestrationV2ThreadPhase, string>> = {
  explore: "Explore",
  build: "Build",
  ready: "Ready",
};
