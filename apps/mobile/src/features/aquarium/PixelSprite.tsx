import Svg, { Rect } from "react-native-svg";

import type { Sprite } from "./sprites";

export function PixelSprite({
  sprite,
  pixel,
}: {
  readonly sprite: Sprite;
  readonly pixel: number;
}) {
  const width = sprite[0]?.runs.reduce((total, run) => total + run.span, 0) ?? 0;
  return (
    <Svg width={width * pixel} height={sprite.length * pixel}>
      {sprite.flatMap((row) =>
        row.runs.flatMap((run) =>
          run.color === null
            ? []
            : [
                <Rect
                  key={`${row.y}:${run.x}`}
                  x={run.x * pixel}
                  y={row.y * pixel}
                  width={run.span * pixel}
                  height={pixel}
                  fill={run.color}
                />,
              ],
        ),
      )}
    </Svg>
  );
}
