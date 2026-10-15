import { Circle, HStack, Rectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { Sprite } from "../features/aquarium/sprites";
import type { AquariumWidgetProps } from "./aquariumSnapshot";

function Aquarium(props: Partial<AquariumWidgetProps>, environment: WidgetEnvironment) {
  "widget";
  const family = environment.widgetFamily;
  const text = "#e8f4fa";
  const muted = "#9fc3d6";
  const counts =
    props.working === undefined || props.needsYou === undefined
      ? null
      : props.working + props.needsYou === 0
        ? null
        : `${props.working} working · ${props.needsYou} need${props.needsYou === 1 ? "s" : ""} you`;
  const caption = props.caption ?? "Open Supadupacode to see your agents";
  const asOf =
    props.updatedAt === undefined
      ? null
      : `As of ${new Date(props.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={2} modifiers={props.url ? [widgetURL(props.url)] : []}>
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>
          {`><> ${counts ?? caption}`}
        </Text>
        {counts === null ? null : (
          <Text modifiers={[font({ textStyle: "caption" }), lineLimit(2)]}>{caption}</Text>
        )}
      </VStack>
    );
  }

  const small = family === "systemSmall";
  const pixel = small ? 2 : 3;
  const perRow = small ? 3 : family === "systemMedium" ? 6 : 4;
  const fish = (props.fish ?? []).slice(0, small ? 3 : family === "systemMedium" ? 6 : 8);
  const rows = Array.from({ length: Math.ceil(fish.length / perRow) }, (_, row) =>
    fish.slice(row * perRow, row * perRow + perRow),
  );
  const sprite = (rowsOfRuns: Sprite) => (
    <VStack spacing={0}>
      {rowsOfRuns.map((row) => (
        <HStack key={row.y} spacing={0}>
          {row.runs.map((run) => (
            <Rectangle
              key={run.x}
              modifiers={[
                foregroundStyle(run.color ?? "#000000"),
                opacity(run.color === null ? 0 : 1),
                frame({ width: run.span * pixel, height: pixel }),
              ]}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );

  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[
        containerBackground(
          {
            type: "linearGradient",
            colors: ["#11648A", "#05193A"],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          },
          "widget",
        ),
        ...(props.url ? [widgetURL(props.url)] : []),
      ]}
    >
      <HStack alignment="top">
        {small || counts === null ? null : (
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "semibold" }),
              foregroundStyle(muted),
              lineLimit(1),
            ]}
          >
            {counts}
          </Text>
        )}
        <Spacer />
        <VStack alignment="trailing" spacing={3}>
          {[6, 4, 3].map((size, index) => (
            <Circle
              key={size}
              modifiers={[
                foregroundStyle("#9fd3ec"),
                opacity(0.45),
                frame({ width: size, height: size }),
                padding({ trailing: index * 4 }),
              ]}
            />
          ))}
        </VStack>
      </HStack>
      <Spacer />
      {rows.map((row) => (
        <HStack key={row[0]?.key} alignment="bottom" spacing={small ? 8 : 14}>
          {row.map((creature) => (
            <VStack
              key={creature.key}
              spacing={2}
              modifiers={[padding({ bottom: creature.lift * (small ? 4 : 6) })]}
            >
              {creature.mark === null ? null : sprite(creature.mark)}
              {sprite(creature.body)}
            </VStack>
          ))}
        </HStack>
      ))}
      <Spacer />
      <Text
        modifiers={[
          font({ textStyle: small ? "caption" : "subheadline", weight: "semibold" }),
          foregroundStyle(text),
          lineLimit(2),
        ]}
      >
        {caption}
      </Text>
      {asOf === null ? null : (
        <Text modifiers={[font({ textStyle: "caption2" }), foregroundStyle(muted), lineLimit(1)]}>
          {asOf}
        </Text>
      )}
    </VStack>
  );
}

export default createWidget("Aquarium", Aquarium);
