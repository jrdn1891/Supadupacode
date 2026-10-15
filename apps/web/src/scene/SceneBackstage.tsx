import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { type BackstageEntry, backstageDetail } from "@supacode/client-runtime/state/backstage";
import type { EnvironmentThreadShell } from "@supacode/client-runtime/state/models";
import type { BackstageCue } from "@supacode/contracts";
import { resolveProjectContext } from "@supacode/shared/projectSettings";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  ShieldQuestionIcon,
  XIcon,
} from "lucide-react";
import { useLayoutEffect, useState } from "react";

import { ThreadContextMarker } from "../components/sidebar/ThreadLabels";
import { Button } from "../components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { useAcknowledgeThreadWoke } from "../hooks/useThreadActions";
import { observeResize } from "../lib/observeResize";
import { cn } from "../lib/utils";
import { useServerConfigs } from "../state/entities";
import { useSceneDragView } from "./sceneDrag";
import { beginSceneDrag } from "./sceneDragGesture";
import { useBackstageEntries } from "./useBackstageEntries";
import { useSceneActions } from "./useSceneActions";

const RING_RADIUS = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const CUE_LOOK: Readonly<
  Record<
    BackstageCue,
    { readonly icon: LucideIcon; readonly hue: string; readonly surface: string }
  >
> = {
  approval: {
    icon: ShieldQuestionIcon,
    hue: "text-warning-foreground",
    surface: "bg-warning-surface hover:bg-warning/20",
  },
  input: {
    icon: MessageCircleQuestionIcon,
    hue: "text-indigo-600 dark:text-indigo-300",
    surface: "bg-indigo-500/10 hover:bg-indigo-500/20",
  },
  failed: {
    icon: CircleAlertIcon,
    hue: "text-error",
    surface: "bg-error-surface hover:bg-error/20",
  },
  limited: {
    icon: CircleAlertIcon,
    hue: "text-warning",
    surface: "bg-warning-surface hover:bg-warning/20",
  },
  ready: { icon: CircleCheckIcon, hue: "text-success", surface: "hover:bg-accent" },
  working: { icon: CircleDashedIcon, hue: "text-info", surface: "hover:bg-accent" },
};

export function SceneBackstage({ stageVisible }: { readonly stageVisible: boolean }) {
  const { entries, nowMs } = useBackstageEntries(stageVisible);
  const dragging = useSceneDragView().ghost !== null;
  if (entries.length === 0)
    return dragging ? (
      <div
        data-scene-backstage
        className="absolute inset-x-0 bottom-0 z-40 flex h-10 items-center justify-center border-t border-dashed border-primary/50 bg-linear-to-t from-primary/15 to-transparent text-xs"
      >
        Send backstage
      </div>
    ) : null;
  return (
    <div
      data-scene-backstage
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 border-t bg-background px-3",
        dragging && "bg-accent/40",
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-medium text-muted-foreground">
        Backstage
        <span className="text-foreground/70 tabular-nums">{entries.length}</span>
      </span>
      <BackstageChips entries={entries} nowMs={nowMs} />
    </div>
  );
}

function BackstageChips({
  entries,
  nowMs,
}: {
  readonly entries: ReadonlyArray<BackstageEntry>;
  readonly nowMs: number;
}) {
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const [folded, setFolded] = useState(0);
  useLayoutEffect(() => {
    if (row === null) return;
    const chips = entries.flatMap(
      (entry) => row.querySelector(`[data-backstage-key="${entry.key}"]`) ?? [],
    );
    return observeResize([row, ...chips], () => {
      const tops = chips.map((chip) => chip.getBoundingClientRect().top);
      setFolded(tops.filter((top) => top !== tops[0]).length);
    });
  }, [entries, row]);
  const shown = entries.length - folded;
  return (
    <>
      <div ref={setRow} className="flex h-7 min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden">
        {entries.map((entry, index) => (
          <BackstageChip key={entry.key} entry={entry} nowMs={nowMs} folded={index >= shown} />
        ))}
      </div>
      {folded > 0 ? <BackstageOverflow entries={entries.slice(shown)} nowMs={nowMs} /> : null}
    </>
  );
}

function BackstageChip({
  entry,
  nowMs,
  folded,
}: {
  readonly entry: BackstageEntry;
  readonly nowMs: number;
  readonly folded: boolean;
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
  const needsYou = cue !== "ready" && cue !== "working";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            data-backstage-key={entry.key}
            data-backstage-cue={cue}
            className={cn(
              "group/chip relative flex h-7 max-w-72 shrink-0 cursor-pointer touch-none items-center gap-2 rounded-md pr-2 pl-3 text-xs outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              CUE_LOOK[cue].surface,
              folded && "invisible",
            )}
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
        <CueIcon cue={cue} progress={thread.progress} />
        <span
          className={cn(
            "min-w-0 truncate",
            cue === "working" ? "text-muted-foreground" : "font-medium",
          )}
        >
          {thread.title}
        </span>
        {detail ? (
          <span
            className={cn(
              "max-w-32 shrink-0 truncate tabular-nums",
              needsYou ? ["font-medium", CUE_LOOK[cue].hue] : "text-muted-foreground",
            )}
          >
            {detail}
          </span>
        ) : null}
        {cue === "ready" ? (
          <button
            type="button"
            aria-label="Mark as seen"
            className="-mr-1 hidden size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground group-focus-within/chip:flex group-hover/chip:flex hover:text-foreground"
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

function BackstageOverflow({
  entries,
  nowMs,
}: {
  readonly entries: ReadonlyArray<BackstageEntry>;
  readonly nowMs: number;
}) {
  const actions = useSceneActions();
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="compact" className="shrink-0" />}>
        +{entries.length}
      </MenuTrigger>
      <MenuPopup side="top" align="end">
        {entries.map(({ key, thread, cue }) => (
          <MenuItem
            key={key}
            onClick={() =>
              actions.open(
                { kind: "server", threadRef: scopeThreadRef(thread.environmentId, thread.id) },
                "right",
              )
            }
          >
            <CueIcon cue={cue} progress={thread.progress} />
            <span className="min-w-0 flex-1 truncate">{thread.title}</span>
            <span className="text-muted-foreground tabular-nums">
              {backstageDetail(thread, cue, nowMs)}
            </span>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function CueIcon({
  cue,
  progress,
}: {
  readonly cue: BackstageCue;
  readonly progress: EnvironmentThreadShell["progress"];
}) {
  const { icon: Icon, hue } = CUE_LOOK[cue];
  if (cue !== "working" || progress === null)
    return <Icon aria-hidden className={cn("size-3.5 shrink-0", hue)} />;
  const fraction = Math.max(progress.done / progress.total, 0.08);
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={cn("size-3.5 shrink-0", hue)}>
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
