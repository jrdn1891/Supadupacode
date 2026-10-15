import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function SupacodeMark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  return (
    <Svg
      accessibilityLabel="Supadupacode"
      height={props.height}
      width={props.height * (81.5 / 46.5)}
      viewBox="23 40.75 81.5 46.5"
    >
      <ThemedPath
        d="M30.957 46.119L43.457 61.119A4.5 4.5 0 0 1 43.457 66.881L30.957 81.881A4.5 4.5 0 0 1 24.043 76.119L34.142 64L24.043 51.881A4.5 4.5 0 0 1 30.957 46.119ZM66.71 42.18L49.21 60.93A4.5 4.5 0 0 0 49.21 67.07L66.71 85.82A4.5 4.5 0 0 0 73.29 79.68L58.655 64L73.29 48.32A4.5 4.5 0 0 0 66.71 42.18ZM85.79 42.18L103.29 60.93A4.5 4.5 0 0 1 103.29 67.07L85.79 85.82A4.5 4.5 0 0 1 79.21 79.68L93.845 64L79.21 48.32A4.5 4.5 0 0 1 85.79 42.18ZM80.75 62A3.25 3.25 0 1 0 87.25 62A3.25 3.25 0 1 0 80.75 62Z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
