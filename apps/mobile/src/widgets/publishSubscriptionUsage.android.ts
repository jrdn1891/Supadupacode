import { requireOptionalNativeModule } from "expo";
import type { SubscriptionUsageSnapshot } from "./subscriptionUsageSnapshot";
import { openOnTap } from "./widgetTaps.android";

export async function publishSubscriptionUsage(snapshot: SubscriptionUsageSnapshot) {
  if (!requireOptionalNativeModule("ExpoWidgets")) return;
  const { default: widget } = await import("./SubscriptionUsage");
  // expo-widgets has no Android counterpart to widgetURL: the card is a
  // button whose tap is delivered to this process, so opening the app needs
  // a live JS runtime.
  await openOnTap("SubscriptionUsage", snapshot.url);
  widget.updateSnapshot(snapshot);
  // Android has no timeline; an alarm re-renders the stored snapshot at each
  // deadline so stale readings flip to "Open Supacode to refresh" unattended.
  requireOptionalNativeModule<{ schedule: (name: string, deadlines: number[]) => void }>(
    "SupacodeWidgetExpiry",
  )?.schedule(
    "SubscriptionUsage",
    snapshot.providers.map((provider) => provider.expiresAt).filter((at) => at > 0),
  );
}
