import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { backstageDetail } from "@supacode/client-runtime/state/backstage";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTheme } from "../hooks/useTheme";
import { observeResize } from "../lib/observeResize";
import { cn } from "../lib/utils";
import { buildThreadRouteParams } from "../threadRoutes";
import {
  AQUARIUM_FPS,
  AQUARIUM_PIXEL,
  type Aquarium,
  type AquariumResident,
  type AquariumSize,
  createAquarium,
  featuredResident,
  fishSize,
  landingSpot,
  leapKeyframes,
  resizeAquarium,
  stepAquarium,
  stockAquarium,
} from "./aquarium.logic";
import {
  type AquariumAppearance,
  CUE_RISE,
  fishBob,
  paintAquarium,
  paintFishSprite,
  paintScenery,
} from "./aquarium.paint";
import { takeRelease } from "./aquariumReleases";
import { useBackstageEntries } from "./useBackstageEntries";

const CEILING_GAP = 12;
const LEAP_MS = 600;
const LEAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

interface TankInput {
  readonly size: AquariumSize | null;
  readonly residents: ReadonlyArray<AquariumResident>;
  readonly featuredKey: string | null;
  readonly appearance: AquariumAppearance;
  readonly reducedMotion: boolean;
}

interface HoveredFish {
  readonly key: string;
  readonly left: number;
  readonly top: number;
}

const castOf = (residents: ReadonlyArray<AquariumResident>) =>
  residents.map((resident) => `${resident.key}:${resident.cue}`).join("|");

let resting: { readonly aquarium: Aquarium; readonly tick: number } | null = null;

function startTank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  let input: TankInput | null = null;
  let aquarium: Aquarium | null = null;
  let scenery: HTMLCanvasElement | null = null;
  let held: string | null = null;
  let tick = resting?.tick ?? 0;
  let timer: number | undefined;
  const leaps = new Map<string, Animation>();

  const paint = () => {
    if (context === null || input === null || aquarium === null || scenery === null) return;
    paintAquarium(context, {
      aquarium,
      scenery,
      residents: new Map(input.residents.map((resident) => [resident.key, resident])),
      tick,
      appearance: input.appearance,
    });
  };

  const step = () => {
    timer = window.setTimeout(step, 1000 / AQUARIUM_FPS);
    if (document.hidden || input === null || aquarium === null) return;
    aquarium = stepAquarium(aquarium, {
      featuredKey: input.featuredKey,
      heldKey: held,
      random: Math.random,
    });
    tick += 1;
    paint();
  };

  const leap = (
    resident: AquariumResident,
    from: { readonly x: number; readonly y: number },
    size: AquariumSize,
    appearance: AquariumAppearance,
  ) => {
    const bounds = canvas.getBoundingClientRect();
    const spot = landingSpot(size, resident.key, (from.x - bounds.left) / AQUARIUM_PIXEL);
    const { width, height } = fishSize(resident.key);
    const sprite = paintFishSprite(spot, resident, tick, appearance);
    sprite.className = "pointer-events-none fixed top-0 left-0 z-30 [image-rendering:pixelated]";
    sprite.style.width = `${width * AQUARIUM_PIXEL}px`;
    sprite.style.height = `${height * AQUARIUM_PIXEL}px`;
    document.body.append(sprite);
    const flight = sprite.animate(
      leapKeyframes(
        { x: from.x - (width * AQUARIUM_PIXEL) / 2, y: from.y - (height * AQUARIUM_PIXEL) / 2 },
        { x: bounds.left + spot.x * AQUARIUM_PIXEL, y: bounds.top + spot.y * AQUARIUM_PIXEL },
        spot.dir,
      ),
      { duration: LEAP_MS, easing: LEAP_EASING, fill: "forwards" },
    );
    leaps.set(resident.key, flight);
    void flight.finished.then(
      () => {
        leaps.delete(resident.key);
        if (
          aquarium !== null &&
          input?.residents.some((current) => current.key === resident.key) &&
          !aquarium.fish.some((fish) => fish.key === resident.key)
        )
          aquarium = {
            ...aquarium,
            fish: [...aquarium.fish, { ...spot, y: spot.y - fishBob(spot.key, tick) }],
          };
        paint();
        sprite.remove();
      },
      () => sprite.remove(),
    );
  };

  return {
    update(next: TankInput) {
      const previous = input;
      input = next;
      if (next.reducedMotion) {
        window.clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) timer = window.setTimeout(step, 1000 / AQUARIUM_FPS);
      if (next.size === null) return;
      if (!next.reducedMotion)
        for (const resident of next.residents) {
          if (leaps.has(resident.key) || aquarium?.fish.some((fish) => fish.key === resident.key))
            continue;
          const from = takeRelease(resident.key);
          if (from !== null) leap(resident, from, next.size, next.appearance);
        }
      const residents = next.residents.filter((resident) => !leaps.has(resident.key));
      const resized = previous?.size !== next.size;
      if (aquarium === null)
        aquarium =
          resting === null
            ? createAquarium(next.size, residents, next.featuredKey, Math.random)
            : stockAquarium(resizeAquarium(resting.aquarium, next.size), residents, Math.random);
      else if (resized) aquarium = resizeAquarium(aquarium, next.size);
      if (resized || previous?.appearance !== next.appearance) {
        canvas.width = next.size.width;
        canvas.height = next.size.height;
        scenery = paintScenery(next.size.width, next.size.height, next.appearance);
      }
      if (previous !== null && castOf(previous.residents) !== castOf(next.residents))
        aquarium = next.reducedMotion
          ? createAquarium(aquarium, residents, next.featuredKey, Math.random)
          : stockAquarium(aquarium, residents, Math.random);
      paint();
    },
    hold(key: string | null) {
      held = key;
    },
    fishAt(x: number, y: number) {
      return (
        aquarium?.fish.find((fish) => {
          const { width, height } = fishSize(fish.key);
          return (
            fish.wait === 0 &&
            x >= fish.x - 2 &&
            x < fish.x + width + 2 &&
            y >= fish.y - 2 &&
            y < fish.y + height + 2
          );
        }) ?? null
      );
    },
    stop() {
      window.clearTimeout(timer);
      for (const flight of leaps.values()) flight.cancel();
      if (aquarium !== null) resting = { aquarium, tick };
    },
  };
}

export function SceneAquarium() {
  const { entries, nowMs } = useBackstageEntries(true);
  const navigate = useNavigate();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const appearance = useTheme().resolvedTheme;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [ceiling, setCeiling] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<AquariumSize | null>(null);
  const [hovered, setHovered] = useState<HoveredFish | null>(null);
  const tankRef = useRef<ReturnType<typeof startTank> | null>(null);
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas === null) return;
    const tank = startTank(canvas);
    tankRef.current = tank;
    return () => {
      tank.stop();
      tankRef.current = null;
    };
  }, []);

  const residents = useMemo(
    () =>
      entries.map((entry): AquariumResident => ({
        key: entry.key,
        projectKey: entry.thread.projectId,
        cue: entry.cue,
      })),
    [entries],
  );
  const featured = featuredResident(entries);
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

  useLayoutEffect(() => {
    tankRef.current?.update({ size, residents, featuredKey, appearance, reducedMotion });
  }, [appearance, featuredKey, reducedMotion, residents, size]);

  const fishUnder = (clientX: number, clientY: number) => {
    if (root === null) return null;
    const bounds = root.getBoundingClientRect();
    return (
      tankRef.current?.fishAt(
        (clientX - bounds.left) / AQUARIUM_PIXEL,
        (clientY - bounds.top) / AQUARIUM_PIXEL,
      ) ?? null
    );
  };

  const hover = (clientX: number, clientY: number) => {
    const fish = fishUnder(clientX, clientY);
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

  return (
    <div
      ref={setRoot}
      data-scene-takeover
      className={cn("absolute inset-0 overflow-hidden", hoveredEntry && "cursor-pointer")}
      onPointerMove={(event) => hover(event.clientX, event.clientY)}
      onPointerLeave={() => {
        tankRef.current?.hold(null);
        setHovered(null);
      }}
      onClick={(event) => {
        const fish = fishUnder(event.clientX, event.clientY);
        const entry = entries.find((candidate) => candidate.key === fish?.key);
        if (entry === undefined) return;
        const { environmentId, id } = entry.thread;
        void navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(scopeThreadRef(environmentId, id)),
        });
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
        {entries.length > 0 ? (
          <p className="max-w-md truncate text-xs text-muted-foreground">
            {featured === null
              ? `${entries.length} ${entries.length === 1 ? "agent" : "agents"} working backstage · nothing needs you`
              : `${featured.thread.title} · ${backstageDetail(featured.thread, featured.cue, nowMs)}`}
          </p>
        ) : null}
      </div>
      {hovered && hoveredEntry ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
          style={{ left: hovered.left, top: hovered.top - 6 }}
        >
          {hoveredEntry.thread.title}
          <span className="ml-1.5 text-muted-foreground tabular-nums">
            {backstageDetail(hoveredEntry.thread, hoveredEntry.cue, nowMs)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
