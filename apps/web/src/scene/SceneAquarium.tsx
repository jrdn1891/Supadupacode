import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  hasUnseenCompletion,
  resolveSidebarThreadStatus,
  resolveThreadLastVisitedAt,
} from "../components/Sidebar.logic";
import { Button } from "../components/ui/button";
import { Popover } from "../components/ui/popover";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNowMinute } from "../hooks/useNowMinute";
import { useTheme } from "../hooks/useTheme";
import { useVisitThread } from "../hooks/useThreadActions";
import { observeResize } from "../lib/observeResize";
import { cn } from "../lib/utils";
import { useContributions } from "../state/contributions";
import { useThreadShells } from "../state/entities";
import { buildThreadRouteParams } from "../threadRoutes";
import { useUiStateStore } from "../uiStateStore";
import {
  type AquariumAppearance,
  CUE_RISE,
  paintAquarium,
} from "@supacode/client-runtime/aquarium/paint";
import { seabedDay, seabedPlants, seabedTally } from "@supacode/client-runtime/aquarium/seabed";
import {
  AQUARIUM_PIXEL,
  type AquariumFish,
  type AquariumPoint,
  type AquariumSize,
  featuredResident,
  fishSize,
  landingSpot,
  leapPath,
} from "@supacode/client-runtime/aquarium/simulation";
import { startTank, tankResidents, type TankInput } from "@supacode/client-runtime/aquarium/tank";
import { canvasPen, paintFishSprite, paintScenery } from "./aquarium.paint";
import { AquariumEffortMenu } from "./AquariumEffortMenu";
import {
  type AquariumAgent,
  agentCueDetail,
  aquariumAgents,
  aquariumCaption,
} from "@supacode/client-runtime/aquarium/agents";
import { AquariumChat } from "./AquariumChat";

const CEILING_GAP = 12;
const LEAP_MS = 600;
const LEAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const TAP_SLOP = 5;

interface HoveredFish {
  readonly key: string;
  readonly left: number;
  readonly top: number;
}

interface Chat {
  readonly key: string;
  readonly open: boolean;
  readonly side: "top" | "bottom";
}

interface Press extends AquariumPoint {
  readonly dragging: boolean;
  readonly since: number;
}

function startCanvasTank(canvas: HTMLCanvasElement, onPrey: (fish: AquariumFish | null) => void) {
  const context = canvas.getContext("2d");
  let size: AquariumSize | null = null;
  let appearance: AquariumAppearance = "light";
  let scenery: HTMLCanvasElement | null = null;
  const tank = startTank({
    paint: (frame) => {
      if (context === null || scenery === null) return;
      context.drawImage(scenery, 0, 0);
      paintAquarium(canvasPen(context), { ...frame, appearance });
    },
    hidden: () => document.hidden,
    leap: (resident, from, tankSize, tick) => {
      const bounds = canvas.getBoundingClientRect();
      const spot = landingSpot(tankSize, resident.key, (from.x - bounds.left) / AQUARIUM_PIXEL);
      const { width, height } = fishSize(resident.key);
      const sprite = paintFishSprite(spot, resident, tick, appearance);
      sprite.className = "pointer-events-none fixed top-0 left-0 z-30 [image-rendering:pixelated]";
      sprite.style.width = `${width * AQUARIUM_PIXEL}px`;
      sprite.style.height = `${height * AQUARIUM_PIXEL}px`;
      document.body.append(sprite);
      const flight = sprite.animate(
        leapPath(
          { x: from.x - (width * AQUARIUM_PIXEL) / 2, y: from.y - (height * AQUARIUM_PIXEL) / 2 },
          { x: bounds.left + spot.x * AQUARIUM_PIXEL, y: bounds.top + spot.y * AQUARIUM_PIXEL },
          spot.dir,
        ).map(({ x, y, tilt, scale, opacity }) => ({
          transform: `translate(${x}px, ${y}px) rotate(${tilt}deg) scale(${scale})`,
          opacity,
        })),
        { duration: LEAP_MS, easing: LEAP_EASING, fill: "forwards" },
      );
      return {
        spot,
        landed: flight.finished.finally(() => sprite.remove()),
        cancel: () => flight.cancel(),
      };
    },
    onPrey,
  });
  return {
    ...tank,
    update(next: TankInput & { readonly appearance: AquariumAppearance }) {
      if (next.size !== null && (next.size !== size || next.appearance !== appearance)) {
        canvas.width = next.size.width;
        canvas.height = next.size.height;
        scenery = paintScenery(next.size.width, next.size.height, next.appearance);
      }
      size = next.size;
      appearance = next.appearance;
      tank.update(next);
    },
  };
}

export function SceneAquarium() {
  const threads = useThreadShells();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const nowMinute = useNowMinute();
  const nowMs = Date.parse(`${nowMinute}:00Z`);
  const entries = useMemo(
    () =>
      aquariumAgents({
        threads,
        status: resolveSidebarThreadStatus,
        unseen: (thread, key) =>
          hasUnseenCompletion({
            ...thread,
            lastVisitedAt: resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisits[key]),
          }),
        now: `${nowMinute}:00Z`,
      }),
    [localVisits, nowMinute, threads],
  );
  const navigate = useNavigate();
  const visitThread = useVisitThread();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const appearance = useTheme().resolvedTheme;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [ceiling, setCeiling] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<AquariumSize | null>(null);
  const [hovered, setHovered] = useState<HoveredFish | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [prey, setPrey] = useState<AquariumFish | null>(null);
  const [daysBack, setDaysBack] = useState(0);
  const tankRef = useRef<ReturnType<typeof startCanvasTank> | null>(null);
  const pressRef = useRef<Press | null>(null);
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas === null) return;
    const tank = startCanvasTank(canvas, setPrey);
    tankRef.current = tank;
    return () => {
      tank.stop();
      tankRef.current = null;
    };
  }, []);

  const residents = useMemo(() => tankResidents(entries), [entries]);
  const featured = featuredResident(entries);
  const caption = aquariumCaption(entries, nowMs);
  const featuredKey = featured?.key ?? null;

  useLayoutEffect(() => {
    if (root === null || ceiling === null) return;
    return observeResize([root, ceiling], () => {
      const next = {
        width: Math.ceil(root.clientWidth / AQUARIUM_PIXEL),
        height: Math.ceil(root.clientHeight / AQUARIUM_PIXEL),
        top:
          Math.ceil((ceiling.offsetTop + ceiling.offsetHeight + CEILING_GAP) / AQUARIUM_PIXEL) +
          CUE_RISE,
      };
      setSize((current) =>
        current?.width === next.width && current.height === next.height && current.top === next.top
          ? current
          : next,
      );
    });
  }, [ceiling, root]);

  const day = useMemo(() => seabedDay(nowMs, daysBack), [daysBack, nowMs]);
  const contributions = useContributions(day);
  const width = size?.width ?? null;
  const seabed = useMemo(
    () =>
      contributions === null || width === null
        ? null
        : { since: day.since, plants: seabedPlants(width, contributions) },
    [contributions, day.since, width],
  );
  const tally = contributions === null ? null : seabedTally(contributions);

  useLayoutEffect(() => {
    tankRef.current?.update({ size, residents, featuredKey, appearance, reducedMotion, seabed });
  }, [appearance, featuredKey, reducedMotion, residents, seabed, size]);

  const chatAgent = chat === null ? undefined : entries.find((entry) => entry.key === chat.key);
  if (chat !== null && chatAgent === undefined) setChat(null);
  const chatKey = chatAgent?.key ?? null;
  const chatCued = chatAgent !== undefined && chatAgent.cue !== "working";
  const chatAnchor = useMemo(() => {
    if (root === null || chatKey === null) return undefined;
    let last = new DOMRect();
    return {
      getBoundingClientRect: () => {
        const fish = tankRef.current?.findFish(chatKey);
        if (fish) {
          const bounds = root.getBoundingClientRect();
          const { width, height } = fishSize(fish.key);
          const rise = chatCued ? CUE_RISE : 0;
          last = new DOMRect(
            bounds.left + fish.x * AQUARIUM_PIXEL,
            bounds.top + (fish.y - rise) * AQUARIUM_PIXEL,
            width * AQUARIUM_PIXEL,
            (height + rise) * AQUARIUM_PIXEL,
          );
        }
        return last;
      },
    };
  }, [chatCued, chatKey, root]);

  useLayoutEffect(() => {
    tankRef.current?.pin(chat?.open ? chat.key : null);
  }, [chat]);

  const visit = ({ thread }: AquariumAgent) =>
    visitThread(scopeThreadRef(thread.environmentId, thread.id), thread.updatedAt);

  const showChat = (key: string, at: AquariumPoint) => {
    if (chat?.open && chat.key === key) {
      setChat({ ...chat, open: false });
      return;
    }
    if (chat?.open && chatAgent) visit(chatAgent);
    setChat({ key, open: true, side: at.y < (size?.height ?? 0) / 2 ? "bottom" : "top" });
  };

  const tankPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / AQUARIUM_PIXEL,
      y: (event.clientY - bounds.top) / AQUARIUM_PIXEL,
    };
  };

  const hover = (at: AquariumPoint) => {
    const fish = tankRef.current?.fishAt(at.x, at.y) ?? null;
    tankRef.current?.hold(fish?.key ?? null);
    setHovered((current) => {
      if (fish === null) return null;
      if (current?.key === fish.key) return current;
      const cued = entries.find((entry) => entry.key === fish.key)?.cue !== "working";
      return {
        key: fish.key,
        left: (fish.x + fishSize(fish.key).width / 2) * AQUARIUM_PIXEL,
        top: (fish.y - (cued ? CUE_RISE : 0)) * AQUARIUM_PIXEL,
      };
    });
  };

  const hoveredEntry =
    hovered === null ? null : (entries.find((entry) => entry.key === hovered.key) ?? null);
  const preyEntry =
    prey === null ? null : (entries.find((entry) => entry.key === prey.key) ?? null);

  return (
    <>
      <div
        ref={setRoot}
        className={cn(
          "absolute inset-0 touch-none overflow-hidden select-none",
          hoveredEntry && "cursor-pointer",
        )}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          pressRef.current = { ...tankPoint(event), dragging: false, since: event.timeStamp };
        }}
        onPointerMove={(event) => {
          if (!event.isPrimary) return;
          const at = tankPoint(event);
          const press = pressRef.current;
          if (press === null) {
            hover(at);
            return;
          }
          if (Math.hypot(at.x - press.x, at.y - press.y) * AQUARIUM_PIXEL < TAP_SLOP) return;
          if (!press.dragging) {
            tankRef.current?.hold(null);
            setHovered(null);
          }
          pressRef.current = { ...press, ...at, dragging: true };
          tankRef.current?.drag(press, at);
        }}
        onPointerUp={(event) => {
          if (!event.isPrimary) return;
          const press = pressRef.current;
          pressRef.current = null;
          if (press === null || press.dragging) return;
          const at = tankPoint(event);
          const fish = tankRef.current?.fishAt(at.x, at.y);
          const entry = entries.find((candidate) => candidate.key === fish?.key);
          if (entry !== undefined) showChat(entry.key, at);
          else if (chat?.open) setChat({ ...chat, open: false });
          else tankRef.current?.tap(at, event.timeStamp - press.since);
        }}
        onPointerCancel={() => {
          pressRef.current = null;
        }}
        onPointerLeave={() => {
          tankRef.current?.hold(null);
          setHovered(null);
        }}
      >
        <canvas
          ref={attachCanvas}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 [image-rendering:pixelated]"
          style={
            size === null
              ? undefined
              : { width: size.width * AQUARIUM_PIXEL, height: size.height * AQUARIUM_PIXEL }
          }
        />
        <div ref={setCeiling} className="absolute inset-x-0 top-0 flex justify-center px-6 pt-10">
          {caption === null ? null : (
            <p className="max-w-md truncate text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        {hovered && hoveredEntry && !chat?.open ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: hovered.left, top: hovered.top - 6 }}
          >
            {hoveredEntry.thread.title}
            <span className="ml-1.5 text-muted-foreground tabular-nums">
              {agentCueDetail(hoveredEntry.thread, hoveredEntry.cue, nowMs)}
            </span>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Button
            variant="ghost-muted"
            size="icon-micro"
            aria-label="Previous day"
            onClick={() => setDaysBack(daysBack + 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">
            {daysBack === 0
              ? "Today"
              : daysBack === 1
                ? "Yesterday"
                : new Date(day.since).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
            {tally === null
              ? null
              : ` · ${tally || (daysBack === 0 ? "nothing grown yet" : "nothing grew")}`}
          </span>
          <Button
            variant="ghost-muted"
            size="icon-micro"
            aria-label="Next day"
            disabled={daysBack === 0}
            onClick={() => setDaysBack(daysBack - 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <Popover
        open={chat?.open === true && chatAgent !== undefined}
        onOpenChange={(open, details) => {
          if (open || chat === null) return;
          const { target } = details.event;
          if (
            details.reason === "outside-press" &&
            target instanceof Node &&
            root?.contains(target)
          )
            return;
          setChat({ ...chat, open: false });
        }}
        onOpenChangeComplete={(open) => {
          if (open || chat?.open !== false) return;
          if (chatAgent) visit(chatAgent);
          setChat(null);
        }}
      >
        {chat !== null && chatAgent ? (
          <AquariumChat
            agent={chatAgent}
            anchor={chatAnchor}
            side={chat.side}
            nowMs={nowMs}
            onOpenThread={() =>
              void navigate({
                to: "/$environmentId/$threadId",
                params: buildThreadRouteParams(
                  scopeThreadRef(chatAgent.thread.environmentId, chatAgent.thread.id),
                ),
              })
            }
          />
        ) : null}
      </Popover>
      {prey && preyEntry ? (
        <AquariumEffortMenu
          thread={preyEntry.thread}
          box={{
            left: prey.x * AQUARIUM_PIXEL,
            top: prey.y * AQUARIUM_PIXEL,
            width: fishSize(prey.key).width * AQUARIUM_PIXEL,
            height: fishSize(prey.key).height * AQUARIUM_PIXEL,
          }}
          onClose={() => tankRef.current?.release()}
        />
      ) : null}
    </>
  );
}
