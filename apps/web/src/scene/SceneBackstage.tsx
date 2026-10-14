import { scopeThreadRef } from "@supacode/client-runtime/environment";
import {
  type BackstageCue,
  type BackstageEntry,
  backstageDetail,
} from "@supacode/client-runtime/state/backstage";
import type { EnvironmentThreadShell } from "@supacode/client-runtime/state/models";
import { resolveProjectContext } from "@supacode/shared/projectSettings";
import { XIcon } from "lucide-react";

import { ThreadContextMarker } from "../components/sidebar/ThreadLabels";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { useAcknowledgeThreadWoke } from "../hooks/useThreadActions";
import { cn } from "../lib/utils";
import { useServerConfigs } from "../state/entities";
import { useSceneDragView } from "./sceneDrag";
import { beginSceneDrag } from "./sceneDragGesture";
import { useBackstageEntries } from "./useBackstageEntries";
import { useSceneActions } from "./useSceneActions";

const RING_RADIUS = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const CUE_COLOR: Readonly<Record<BackstageCue, string>> = {
  "needs-you": "text-destructive-foreground",
  ready: "text-success-foreground",
  standby: "text-warning-foreground",
  working: "text-muted-foreground",
};

export function SceneBackstage() {
  const { entries, nowMs } = useBackstageEntries(true);
  const dragging = useSceneDragView().ghost !== null;
  if (entries.length === 0 && !dragging) return null;
  return (
    <div
      data-scene-backstage
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-t bg-background px-3",
        dragging && "bg-accent/40",
      )}
    >
      <span className="shrink-0 pr-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        Backstage
      </span>
      {entries.length === 0 ? (
        <span className="text-xs text-muted-foreground">Drop a pane here to send it backstage</span>
      ) : (
        entries.map((entry) => <BackstageChip key={entry.key} entry={entry} nowMs={nowMs} />)
      )}
    </div>
  );
}

function BackstageChip({
  entry,
  nowMs,
}: {
  readonly entry: BackstageEntry;
  readonly nowMs: number;
}) {
  const { thread, cue } = entry;
  const actions = useSceneActions();
  const acknowledge = useAcknowledgeThreadWoke();
  const context = resolveProjectContext(
    useServerConfigs().get(thread.environmentId)?.settings ?? null,
    thread.projectId,
  );
  const target = {
    kind: "server",
    threadRef: scopeThreadRef(thread.environmentId, thread.id),
  } as const;
  const detail = backstageDetail(thread, cue, nowMs);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            data-backstage-cue={cue}
            className="group/chip relative flex h-7 max-w-72 shrink-0 cursor-pointer touch-none items-center gap-2 rounded-md border bg-background pr-2 pl-3 text-xs outline-none select-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => actions.open(target, "right")}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              actions.open(target, "right");
            }}
            onPointerDown={(event) =>
              beginSceneDrag(event, {
                title: thread.title,
                onRelease: ({ target: dropTarget }) => {
                  if (dropTarget?.kind === "pane")
                    actions.dropAll([target], dropTarget.paneId, dropTarget.zone);
                },
              })
            }
          />
        }
      >
        {context ? <ThreadContextMarker context={context} /> : null}
        <CueRing cue={cue} progress={thread.progress} />
        <span className="min-w-0 truncate font-medium">{thread.title}</span>
        {detail ? (
          <span className="max-w-32 shrink-0 truncate text-muted-foreground tabular-nums">
            {detail}
          </span>
        ) : null}
        {cue === "ready" ? (
          <button
            type="button"
            aria-label="Mark as seen"
            className="-mr-1 hidden size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground group-hover/chip:flex hover:text-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              acknowledge(target.threadRef, new Date().toISOString());
            }}
          >
            <XIcon className="size-3" />
          </button>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="top">
        {thread.progress?.current ?? thread.title}
        <span className="block text-muted-foreground">
          Click to bring on stage, or drag onto a pane
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}

function CueRing({
  cue,
  progress,
}: {
  readonly cue: BackstageCue;
  readonly progress: EnvironmentThreadShell["progress"];
}) {
  const fraction =
    cue === "ready" || cue === "needs-you"
      ? 1
      : progress === null
        ? 0.25
        : Math.max(progress.done / progress.total, 0.08);
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={cn("size-3.5 shrink-0", CUE_COLOR[cue])}>
      <circle
        cx="7"
        cy="7"
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={2}
      />
      <circle
        cx="7"
        cy="7"
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}
