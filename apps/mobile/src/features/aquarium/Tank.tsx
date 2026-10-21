import { useAtomValue } from "@effect/atom-react";
import { useIsFocused } from "@react-navigation/native";
import { type AquariumAgent, aquariumCaption } from "@supacode/client-runtime/aquarium/agents";
import {
  type AquariumAppearance,
  CUE_RISE,
  fishBob,
  paintAquarium,
  paintFish,
  paintSceneryDetails,
  sceneryPalette,
  sceneryPixel,
} from "@supacode/client-runtime/aquarium/paint";
import { seabedDay, seabedPlants, seabedTally } from "@supacode/client-runtime/aquarium/seabed";
import {
  AQUARIUM_PIXEL,
  type AquariumFish,
  type AquariumResident,
  featuredResident,
  fishSize,
  landingSpot,
  type LeapFrame,
  leapPath,
} from "@supacode/client-runtime/aquarium/simulation";
import {
  startTank,
  type TankFrame,
  type TankLeap,
  tankResidents,
} from "@supacode/client-runtime/aquarium/tank";
import type { Contribution, ContributionListInput } from "@supacode/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, type GestureResponderEvent, Pressable, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { useReducedMotionPreference } from "../../lib/useReducedMotionPreference";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { aquariumAgentsAtom } from "./agents";
import { type PenPath, recordPaths } from "./svgPen";

const CEILING_GAP = 12;
const LEAP_MS = 600;

const captionAtom = Atom.make((get) => aquariumCaption(get(aquariumAgentsAtom), Date.now()));

const contributionsAtom = Atom.family((day: string) =>
  Atom.make((get) => {
    const input = JSON.parse(day) as ContributionListInput;
    const answered = [...get(environmentPresentations.presentationsAtom).keys()].flatMap(
      (environmentId) => {
        const contributions = Option.getOrNull(
          AsyncResult.value(get(serverEnvironment.contributions({ environmentId, input }))),
        );
        return contributions === null ? [] : [contributions];
      },
    );
    return answered.length === 0
      ? null
      : [
          ...new Map(
            answered
              .flat()
              .map((contribution): [string, Contribution] => [contribution.key, contribution]),
          ).values(),
        ];
  }),
);

interface Flight {
  readonly resident: AquariumResident;
  readonly spot: AquariumFish;
  readonly tick: number;
  readonly frames: ReadonlyArray<LeapFrame>;
  readonly land: () => void;
}

let flights: ReadonlyArray<Flight> = [];
const flightListeners = new Set<() => void>();

function setFlights(next: ReadonlyArray<Flight>) {
  flights = next;
  for (const listener of flightListeners) listener();
}

function subscribeFlights(listener: () => void) {
  flightListeners.add(listener);
  return () => {
    flightListeners.delete(listener);
  };
}

function launch(flight: Omit<Flight, "land">): TankLeap {
  let land = () => {};
  let abort = () => {};
  const landed = new Promise<void>((resolve, reject) => {
    land = resolve;
    abort = () => reject(new Error("The tank closed mid-leap."));
  });
  const entry: Flight = { ...flight, land: () => land() };
  setFlights([...flights, entry]);
  return {
    spot: flight.spot,
    landed: landed.finally(() => setFlights(flights.filter((current) => current !== entry))),
    cancel: () => abort(),
  };
}

const PixelPaths = memo(function PixelPaths(props: {
  readonly paths: ReadonlyArray<PenPath>;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <Svg
      width={props.width * AQUARIUM_PIXEL}
      height={props.height * AQUARIUM_PIXEL}
      viewBox={`0 0 ${props.width} ${props.height}`}
    >
      {props.paths.map((path) => (
        <Path key={path.key} d={path.d} fill={path.color} fillOpacity={path.opacity} />
      ))}
    </Svg>
  );
});

function paintScenery(width: number, height: number, appearance: AquariumAppearance) {
  const pixels = Array.from({ length: width * height }, (_, index) =>
    sceneryPixel(appearance, width, height, index % width, Math.floor(index / width)),
  );
  return recordPaths((pen) => {
    sceneryPalette(appearance).forEach((color, shade) =>
      pixels.forEach((pixel, index) => {
        if (pixel === shade) pen.fill(color, index % width, Math.floor(index / width), 1, 1);
      }),
    );
    paintSceneryDetails(pen, width, height, appearance);
  });
}

export function Tank(props: {
  readonly topInset: number;
  readonly bottomInset: number;
  readonly interceptTap: (() => void) | null;
  readonly onOpenAgent: (agent: AquariumAgent) => void;
}) {
  const agents = useAtomValue(aquariumAgentsAtom);
  const caption = useAtomValue(captionAtom);
  const appearance = useAppearancePreferences().themeAppearance;
  const reducedMotion = useReducedMotionPreference();
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  const [layout, setLayout] = useState<{ readonly width: number; readonly height: number } | null>(
    null,
  );
  const [ceiling, setCeiling] = useState<number | null>(null);
  const [frame, setFrame] = useState<TankFrame | null>(null);
  const [today] = useState(Date.now);
  const [daysBack, setDaysBack] = useState(0);
  const tankRef = useRef<ReturnType<typeof startTank> | null>(null);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useLayoutEffect(() => {
    const tank = startTank({
      paint: setFrame,
      hidden: () => AppState.currentState !== "active" || !focusedRef.current,
      leap: (resident, from, size, tick) => {
        const spot = landingSpot(size, resident.key, from.x / AQUARIUM_PIXEL);
        const { width, height } = fishSize(resident.key);
        return launch({
          resident,
          spot,
          tick,
          frames: leapPath(
            {
              x: from.x - (width * AQUARIUM_PIXEL) / 2,
              y: from.y - (height * AQUARIUM_PIXEL) / 2,
            },
            { x: spot.x * AQUARIUM_PIXEL, y: spot.y * AQUARIUM_PIXEL },
            spot.dir,
          ),
        });
      },
    });
    tankRef.current = tank;
    return () => {
      tank.stop();
      tankRef.current = null;
    };
  }, []);

  const tankWidth = layout === null ? null : Math.ceil(layout.width / AQUARIUM_PIXEL);
  const tankHeight = layout === null ? null : Math.ceil(layout.height / AQUARIUM_PIXEL);
  const tankTop =
    ceiling === null ? null : Math.ceil((ceiling + CEILING_GAP) / AQUARIUM_PIXEL) + CUE_RISE;
  const size = useMemo(
    () =>
      tankWidth === null || tankHeight === null || tankTop === null
        ? null
        : { width: tankWidth, height: tankHeight, top: tankTop },
    [tankHeight, tankTop, tankWidth],
  );
  const residents = useMemo(() => tankResidents(agents), [agents]);
  const featuredKey = featuredResident(agents)?.key ?? null;
  const day = useMemo(() => seabedDay(today, daysBack), [daysBack, today]);
  const contributions = useAtomValue(contributionsAtom(JSON.stringify(day)));
  const width = size?.width ?? null;
  const seabed = useMemo(
    () =>
      contributions === null || width === null
        ? null
        : { since: day.since, plants: seabedPlants(width, contributions) },
    [contributions, day.since, width],
  );
  const tally = contributions === null ? null : seabedTally(contributions);
  const scenery = useMemo(
    () => (size === null ? null : paintScenery(size.width, size.height, appearance)),
    [appearance, size],
  );
  const paths = useMemo(
    () =>
      frame === null ? null : recordPaths((pen) => paintAquarium(pen, { ...frame, appearance })),
    [appearance, frame],
  );

  useLayoutEffect(() => {
    tankRef.current?.update({ size, residents, featuredKey, reducedMotion, seabed });
  }, [featuredKey, reducedMotion, residents, seabed, size]);

  const tapAt = (event: GestureResponderEvent) => {
    if (props.interceptTap !== null) {
      props.interceptTap();
      return;
    }
    const at = {
      x: event.nativeEvent.locationX / AQUARIUM_PIXEL,
      y: event.nativeEvent.locationY / AQUARIUM_PIXEL,
    };
    const fish = tankRef.current?.fishAt(at.x, at.y);
    const agent = agents.find((candidate) => candidate.key === fish?.key);
    if (agent !== undefined) props.onOpenAgent(agent);
    else tankRef.current?.tap(at);
  };

  return (
    <View
      className="absolute top-0 right-0 left-0 overflow-hidden"
      style={{ bottom: props.bottomInset }}
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
    >
      <Pressable accessible={false} className="absolute inset-0" onPress={tapAt}>
        {size === null || scenery === null ? null : (
          <View className="absolute top-0 left-0">
            <PixelPaths paths={scenery} width={size.width} height={size.height} />
          </View>
        )}
        {size === null || paths === null ? null : (
          <View className="absolute top-0 left-0">
            <PixelPaths paths={paths} width={size.width} height={size.height} />
          </View>
        )}
      </Pressable>
      <View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 items-center px-6"
        style={{ paddingTop: props.topInset + 12 }}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setCeiling(y + height);
        }}
      >
        {caption === null ? null : (
          <Text className="text-xs text-foreground-muted" numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
      <View className="absolute right-0 bottom-0 left-0 flex-row items-center justify-center gap-1">
        <Pressable
          accessibilityLabel="Previous day"
          accessibilityRole="button"
          hitSlop={10}
          className="p-1 active:opacity-60"
          onPress={() => setDaysBack(daysBack + 1)}
        >
          <SymbolView
            name="chevron.left"
            size={12}
            tintColorClassName="accent-icon-muted"
            type="monochrome"
          />
        </Pressable>
        <Text className="text-xs text-foreground-muted tabular-nums">
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
        </Text>
        <Pressable
          accessibilityLabel="Next day"
          accessibilityRole="button"
          disabled={daysBack === 0}
          hitSlop={10}
          className="p-1 active:opacity-60 disabled:opacity-30"
          onPress={() => setDaysBack(daysBack - 1)}
        >
          <SymbolView
            name="chevron.right"
            size={12}
            tintColorClassName="accent-icon-muted"
            type="monochrome"
          />
        </Pressable>
      </View>
    </View>
  );
}

function Leap(props: { readonly flight: Flight }) {
  const { flight } = props;
  const appearance = useAppearancePreferences().themeAppearance;
  const { width, height } = fishSize(flight.resident.key);
  const paths = useMemo(
    () =>
      recordPaths((pen) =>
        paintFish(
          pen,
          { ...flight.spot, x: 0, y: -fishBob(flight.resident.key, flight.tick) },
          flight.resident,
          flight.tick,
          appearance,
        ),
      ),
    [appearance, flight],
  );
  const track = useMemo(
    () => ({
      stops: flight.frames.map((_, index) => index / (flight.frames.length - 1)),
      x: flight.frames.map((point) => point.x),
      y: flight.frames.map((point) => point.y),
      tilt: flight.frames.map((point) => point.tilt),
      scale: flight.frames.map((point) => point.scale),
      opacity: flight.frames.map((point) => point.opacity),
    }),
    [flight.frames],
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withTiming(1, { duration: LEAP_MS, easing: Easing.bezier(0.32, 0.72, 0, 1) }, (finished) => {
        if (finished) runOnJS(flight.land)();
      }),
    );
  }, [flight.land, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), track.stops, track.opacity),
    transform: [
      { translateX: interpolate(progress.get(), track.stops, track.x) },
      { translateY: interpolate(progress.get(), track.stops, track.y) },
      { rotate: `${interpolate(progress.get(), track.stops, track.tilt)}deg` },
      { scale: interpolate(progress.get(), track.stops, track.scale) },
    ],
  }));

  return (
    <Animated.View
      className="absolute top-0 left-0"
      style={[{ width: width * AQUARIUM_PIXEL, height: height * AQUARIUM_PIXEL }, style]}
    >
      <PixelPaths paths={paths} width={width} height={height} />
    </Animated.View>
  );
}

export function TankLeaps() {
  const current = useSyncExternalStore(subscribeFlights, () => flights);
  return (
    <View pointerEvents="none" className="absolute inset-0">
      {current.map((flight) => (
        <Leap key={flight.resident.key} flight={flight} />
      ))}
    </View>
  );
}
