import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HostProcess from "@supacode/shared/HostProcess";

import * as DesktopIpc from "../DesktopIpc.ts";
import { REQUEST_ATTENTION_CHANNEL } from "../channels.ts";

export const requestAttention = DesktopIpc.makeIpcMethod({
  channel: REQUEST_ATTENTION_CHANNEL,
  payload: Schema.Literals(["informational", "critical"]),
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.requestAttention")(function* (kind) {
    const platform = yield* HostProcess.Platform;
    if (Electron.BrowserWindow.getFocusedWindow()) return;
    if (platform === "darwin") {
      Electron.app.dock?.bounce(kind);
      return;
    }
    for (const window of Electron.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.flashFrame(true);
    }
  }),
});
