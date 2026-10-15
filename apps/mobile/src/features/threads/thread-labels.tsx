import { THREAD_PHASE_LABELS } from "@supacode/client-runtime/state/thread-phase";
import { OrchestrationV2ThreadPhase, type ProjectContext } from "@supacode/contracts";
import { View } from "react-native";

import { cn } from "../../lib/cn";
import { projectIconColorClassNames } from "../../lib/projectIcon";

export function ThreadPhasePips({ phase }: { readonly phase: OrchestrationV2ThreadPhase }) {
  const reached = OrchestrationV2ThreadPhase.literals.indexOf(phase);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Phase: ${THREAD_PHASE_LABELS[phase]}`}
      className="flex-row items-center gap-0.5"
    >
      {OrchestrationV2ThreadPhase.literals.map((step, index) => (
        <View
          key={step}
          className={cn(
            "h-2 w-1 rounded-xs",
            index <= reached ? "bg-foreground-muted" : "bg-foreground/10",
          )}
        />
      ))}
    </View>
  );
}

export function ThreadContextDot({ context }: { readonly context: ProjectContext }) {
  return (
    <View
      accessible
      accessibilityLabel={context.name}
      className={cn("size-2 rounded-full", projectIconColorClassNames(context.color).solid)}
    />
  );
}
