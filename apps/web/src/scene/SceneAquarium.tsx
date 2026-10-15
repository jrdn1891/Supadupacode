import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { type BackstageEntry, backstageDetail } from "@supacode/client-runtime/state/backstage";
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTheme } from "../hooks/useTheme";
import { observeResize } from "../lib/observeResize";
import { cn } from "../lib/utils";
import {
  AQUARIUM_FPS,
  AQUARIUM_PIXEL,
  type Aquarium,
  type AquariumResident,
  type AquariumSize,
  createAquarium,
  featuredResident,
  fishSize,
  resizeAquarium,
  stepAquarium,
  stockAquarium,
} from "./aquarium.logic";
import { type AquariumAppearance, CUE_RISE, paintAquarium, paintScenery } from "./aquarium.paint";
import { useSceneActions } from "./useSceneActions";

const CEILING_GAP = 12;

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

function startTank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  let input: TankInput | null = null;
  let aquarium: Aquarium | null = null;
  let scenery: HTMLCanvasElement | null = null;
  let held: string | null = null;
  let tick = 0;
  let timer: number | undefined;

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

  return {
    update(next: TankInput) {
      const previous = input;
      input = next;
      if (next.reducedMotion) {
        window.clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) timer = window.setTimeout(step, 1000 / AQUARIUM_FPS);
      if (next.size === null) return;
      const resized = previous?.size !== next.size;
      if (aquarium === null)
        aquarium = createAquarium(next.size, next.residents, next.featuredKey, Math.random);
      else if (resized) aquarium = resizeAquarium(aquarium, next.size);
      if (resized || previous?.appearance !== next.appearance) {
        canvas.width = next.size.width;
        canvas.height = next.size.height;
        scenery = paintScenery(next.size.width, next.size.height, next.appearance);
      }
      if (previous !== null && castOf(previous.residents) !== castOf(next.residents))
        aquarium = next.reducedMotion
          ? createAquarium(aquarium, next.residents, next.featuredKey, Math.random)
          : stockAquarium(aquarium, next.residents, Math.random);
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
    },
  };
}

export function SceneAquarium({
  entries,
  nowMs,
  children,
}: {
  readonly entries: ReadonlyArray<BackstageEntry>;
  readonly nowMs: number;
  readonly children: ReactNode;
}) {
  const actions = useSceneActions();
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
  const featuredKey = featuredResident(entries)?.key ?? null;

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

  const hover = (clientX: number, clientY: number) => {
    if (root === null) return;
    const bounds = root.getBoundingClientRect();
    const fish =
      tankRef.current?.fishAt(
        (clientX - bounds.left) / AQUARIUM_PIXEL,
        (clientY - bounds.top) / AQUARIUM_PIXEL,
      ) ?? null;
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
      className={cn("relative min-h-0 flex-1 overflow-hidden", hoveredEntry && "cursor-pointer")}
      onPointerMove={(event) => hover(event.clientX, event.clientY)}
      onPointerLeave={() => {
        tankRef.current?.hold(null);
        setHovered(null);
      }}
      onClick={() => {
        if (hoveredEntry === null) return;
        const { environmentId, id } = hoveredEntry.thread;
        actions.open({ kind: "server", threadRef: scopeThreadRef(environmentId, id) }, "right");
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
        {children}
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
