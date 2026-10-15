import {
  BUBBLE_BURST_MS,
  BUBBLE_RISE_MS,
  BUBBLES,
} from "@supacode/client-runtime/aquarium/bubbles";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotionPreference } from "../../lib/useReducedMotionPreference";

const RISE = Easing.inOut(Easing.ease);

export function ThreadListBubbles({ since }: { readonly since: number }) {
  const reducedMotion = useReducedMotionPreference();
  const [elapsed] = useState(() => Date.now() - since);
  const [done, setDone] = useState(elapsed >= BUBBLE_BURST_MS);
  const clock = useSharedValue(elapsed);
  const height = useSharedValue(0);

  useEffect(() => {
    if (done) return;
    clock.set(
      withTiming(BUBBLE_BURST_MS, { duration: BUBBLE_BURST_MS - elapsed, easing: Easing.linear }),
    );
    const timeout = setTimeout(() => setDone(true), BUBBLE_BURST_MS - elapsed);
    return () => clearTimeout(timeout);
  }, [clock, done, elapsed]);

  if (done || reducedMotion) return null;
  return (
    <View
      pointerEvents="none"
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      onLayout={(event) => {
        height.set(event.nativeEvent.layout.height);
      }}
    >
      {BUBBLES.map((bubble) => (
        <Bubble key={bubble.left} bubble={bubble} clock={clock} height={height} />
      ))}
    </View>
  );
}

function Bubble(props: {
  readonly bubble: (typeof BUBBLES)[number];
  readonly clock: SharedValue<number>;
  readonly height: SharedValue<number>;
}) {
  const { bubble, clock, height } = props;
  const style = useAnimatedStyle(() => {
    const rise = RISE(Math.min(1, Math.max(0, (clock.get() - bubble.delay) / BUBBLE_RISE_MS)));
    const stops = [0, 0.33, 0.66, 1];
    return {
      opacity: interpolate(rise, [0, 0.08, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: interpolate(rise, stops, [0, bubble.drift, -bubble.drift, bubble.drift]) },
        {
          translateY: interpolate(rise, stops, [
            bubble.size,
            -0.33 * height.get(),
            -0.66 * height.get(),
            -height.get(),
          ]),
        },
        { scale: interpolate(rise, stops, [0.6, 0.8, 0.95, 1]) },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute bottom-0 rounded-full border border-adaptive-blue-500-400 bg-adaptive-blue-500-a20-blue-400-a15"
      style={[{ left: bubble.left, width: bubble.size, height: bubble.size }, style]}
    />
  );
}
