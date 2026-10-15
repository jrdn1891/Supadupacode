import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { type DesktopBackstageItem, DesktopBackstageItemSchema } from "@supacode/contracts";
import * as HostProcess from "@supacode/shared/HostProcess";

import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import { BACKSTAGE_OPEN_CHANNEL, SET_BACKSTAGE_SUMMARY_CHANNEL } from "../channels.ts";

const CUE_GLYPH: Readonly<Record<DesktopBackstageItem["cue"], string>> = {
  "needs-you": "⚠︎",
  ready: "✓",
  standby: "◕",
  working: "◐",
};

export const installBackstageTray = Effect.fn("desktop.ipc.installBackstageTray")(function* () {
  const ipc = yield* DesktopIpc.DesktopIpc;
  const electronWindow = yield* ElectronWindow.ElectronWindow;
  const platform = yield* HostProcess.Platform;
  let tray: Electron.Tray | null = null;
  const open = (item: DesktopBackstageItem) =>
    Effect.runFork(
      Effect.gen(function* () {
        const window = yield* electronWindow.currentMainOrFirst;
        if (Option.isNone(window) || window.value.webContents.isDestroyed()) return;
        window.value.webContents.send(BACKSTAGE_OPEN_CHANNEL, {
          environmentId: item.environmentId,
          threadId: item.threadId,
        });
        yield* electronWindow.reveal(window.value);
      }),
    );
  const render = (items: ReadonlyArray<DesktopBackstageItem>) => {
    const top = items[0];
    if (top === undefined) {
      tray?.destroy();
      tray = null;
      return;
    }
    tray ??= new Electron.Tray(Electron.nativeImage.createEmpty());
    tray.setTitle(`${CUE_GLYPH[top.cue]} ${items.length}`);
    tray.setToolTip("Backstage");
    tray.setContextMenu(
      Electron.Menu.buildFromTemplate([
        { label: "Backstage", enabled: false },
        { type: "separator" },
        ...items.map((item) => ({
          label: `${CUE_GLYPH[item.cue]}  ${item.title}${item.detail ? `  ·  ${item.detail}` : ""}`,
          click: () => open(item),
        })),
      ]),
    );
  };
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: SET_BACKSTAGE_SUMMARY_CHANNEL,
      payload: Schema.Array(DesktopBackstageItemSchema).check(Schema.isMaxLength(20)),
      result: Schema.Void,
      handler: (items) =>
        Effect.sync(() => {
          if (platform === "darwin") render(items);
        }),
    }),
  );
  yield* Effect.addFinalizer(() => Effect.sync(() => render([])));
});
