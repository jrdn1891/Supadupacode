import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HostProcess from "@supacode/shared/HostProcess";

import { performMacHaptic } from "../../electron/MacHaptics.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import { PERFORM_HAPTIC_CHANNEL } from "../channels.ts";

export const performHaptic = DesktopIpc.makeIpcMethod({
  channel: PERFORM_HAPTIC_CHANNEL,
  payload: Schema.Literals(["generic", "alignment", "level-change"]),
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.performHaptic")(function* (pattern) {
    if ((yield* HostProcess.Platform) !== "darwin") return;
    yield* Effect.promise(() => performMacHaptic(pattern).catch(() => undefined));
  }),
});
