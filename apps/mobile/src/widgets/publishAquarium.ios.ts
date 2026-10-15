import { requireOptionalNativeModule } from "expo";
import type { AquariumWidgetProps } from "./aquariumSnapshot";

export async function publishAquarium(props: AquariumWidgetProps) {
  if (!requireOptionalNativeModule("ExpoWidgets")) return;
  const { default: widget } = await import("./Aquarium");
  widget.updateSnapshot(props);
}
