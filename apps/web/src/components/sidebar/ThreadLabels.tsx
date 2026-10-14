import { THREAD_PHASE_LABELS } from "@supacode/client-runtime/state/thread-phase";
import {
  OrchestrationV2ThreadPhase,
  type OrchestrationV2ThreadPhase as ThreadPhase,
  type ProjectContext,
} from "@supacode/contracts";

import { PROJECT_ICON_COLORS } from "~/projectIconColors";
import { cn } from "~/lib/utils";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function ThreadPhasePips({ phase }: { phase: ThreadPhase }) {
  const reached = OrchestrationV2ThreadPhase.literals.indexOf(phase);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={`Phase: ${THREAD_PHASE_LABELS[phase]}`}
            className="inline-flex h-4 shrink-0 items-center gap-0.5"
          />
        }
      >
        {OrchestrationV2ThreadPhase.literals.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-2 w-1 rounded-xs",
              index <= reached ? "bg-muted-foreground/70" : "bg-muted-foreground/20",
            )}
          />
        ))}
      </TooltipTrigger>
      <TooltipPopup side="top">{THREAD_PHASE_LABELS[phase]}</TooltipPopup>
    </Tooltip>
  );
}

export function ThreadContextMarker({ context }: { context: ProjectContext }) {
  const swatch = PROJECT_ICON_COLORS.find((color) => color.value === context.color);
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-y-2 left-0.5 w-[3px] rounded-full",
        swatch?.swatchClassName,
      )}
    >
      <span className="sr-only">{context.name}</span>
    </span>
  );
}
