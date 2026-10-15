import { useEffect } from "react";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotionPreference } from "../../lib/useReducedMotionPreference";
import { PixelSprite } from "./PixelSprite";
import { creatureSprite } from "./sprites";

const LEAP_MS = 600;

export function FishLeap(props: {
  readonly fishKey: string;
  readonly projectKey: string;
  readonly onLanded: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(0);
  const { onLanded } = props;

  useEffect(() => {
    if (reducedMotion) {
      onLanded();
      return;
    }
    progress.set(
      withTiming(1, { duration: LEAP_MS, easing: Easing.bezier(0.32, 0.72, 0, 1) }, (finished) => {
        if (finished) runOnJS(onLanded)();
      }),
    );
  }, [onLanded, progress, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: -160 * progress.get() },
      { translateY: -40 * progress.get() - 90 * Math.sin(Math.PI * progress.get()) },
      { rotate: `${interpolate(progress.get(), [0, 1], [-30, 20])}deg` },
      { scale: 0.6 + 0.4 * progress.get() },
      { scaleX: -1 },
    ],
  }));

  if (reducedMotion) return null;
  return (
    <Animated.View pointerEvents="none" className="absolute" style={style}>
      <PixelSprite sprite={creatureSprite(props.fishKey, props.projectKey)} pixel={3} />
    </Animated.View>
  );
}
