import { requireOptionalNativeModule } from "expo";
import type { AquariumWidgetProps } from "./aquariumSnapshot";
import { openOnTap } from "./widgetTaps.android";

export async function publishAquarium(props: AquariumWidgetProps) {
  if (!requireOptionalNativeModule("ExpoWidgets")) return;
  const { default: widget } = await import("./Aquarium");
  await openOnTap("Aquarium", props.url);
  widget.updateSnapshot(props);
}
