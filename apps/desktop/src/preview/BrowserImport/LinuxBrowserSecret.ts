import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { resolveNativeHelper } from "../../app/NativeHelper.ts";

/** Absolute path to the helper shipped with this desktop instance. */
export const LinuxBrowserSecretPath = Context.Reference<string | undefined>(
  "@supacode/desktop/preview/BrowserImport/LinuxBrowserSecretPath",
  { defaultValue: () => undefined },
);

export const layer = Layer.effect(
  LinuxBrowserSecretPath,
  resolveNativeHelper("linux", "browser-secret"),
);
