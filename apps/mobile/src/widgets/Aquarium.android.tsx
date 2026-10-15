import { Box, Button, Column, Row, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget } from "expo-widgets";

import type { Sprite } from "../features/aquarium/sprites";
import type { AquariumWidgetProps } from "./aquariumSnapshot";

export function Aquarium(props: Partial<AquariumWidgetProps>) {
  "widget";
  const pixel = 3;
  const chunks = <T,>(items: ReadonlyArray<T>) =>
    Array.from({ length: Math.ceil(items.length / 8) }, (_, index) =>
      items.slice(index * 8, index * 8 + 8),
    );
  const sprite = (rowsOfRuns: Sprite) => (
    <Column>
      {chunks(rowsOfRuns).map((rows) => (
        <Column key={rows[0]?.y}>
          {rows.map((row) => (
            <Row key={row.y}>
              {chunks(row.runs).map((spans) => (
                <Row key={spans[0]?.x}>
                  {spans.map((run) => (
                    <Box
                      key={run.x}
                      modifiers={[
                        size(run.span * pixel, pixel),
                        ...(run.color === null ? [] : [background(run.color)]),
                      ]}
                    />
                  ))}
                </Row>
              ))}
            </Row>
          ))}
        </Column>
      ))}
    </Column>
  );
  const counts =
    props.working === undefined || props.needsYou === undefined
      ? null
      : props.working + props.needsYou === 0
        ? null
        : `${props.working} working · ${props.needsYou} need${props.needsYou === 1 ? "s" : ""} you`;
  return (
    <Button colors={{ containerColor: "#0B3B5E" }} modifiers={[fillMaxSize()]} onClick={() => {}}>
      <Column modifiers={[fillMaxSize(), paddingAll(16)]}>
        {counts === null ? null : (
          <Text color="#9fc3d6" maxLines={1} style={{ fontSize: 12, fontWeight: "bold" }}>
            {counts}
          </Text>
        )}
        <Row modifiers={[fillMaxWidth(), padding(0, 12, 0, 12)]}>
          {(props.fish ?? []).slice(0, 5).map((creature) => (
            <Column key={creature.key} modifiers={[padding(0, (2 - creature.lift) * 6, 12, 0)]}>
              {creature.mark === null ? null : sprite(creature.mark)}
              {sprite(creature.body)}
            </Column>
          ))}
        </Row>
        <Text color="#e8f4fa" maxLines={2} style={{ fontSize: 14, fontWeight: "bold" }}>
          {props.caption ?? "Open Supadupacode to see your agents"}
        </Text>
        {props.updatedAt === undefined ? null : (
          <Text color="#9fc3d6" maxLines={1} style={{ fontSize: 10 }}>
            {`As of ${new Date(props.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
          </Text>
        )}
      </Column>
    </Button>
  );
}

export default createWidget("Aquarium", Aquarium);
