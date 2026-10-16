import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import * as DesktopEnvironment from "./DesktopEnvironment.ts";

export const resolveNativeHelper = Effect.fn("resolveNativeHelper")(function* (
  platform: NodeJS.Platform,
  name: string,
) {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  if (environment.platform !== platform) return undefined;
  const fileSystem = yield* FileSystem.FileSystem;
  const executable = `supacode-${name}`;
  const relative = environment.path.join(name, executable);
  const candidates = environment.isPackaged
    ? [environment.path.join(environment.resourcesPath, relative)]
    : [
        environment.path.join(
          environment.rootDir,
          "native",
          name,
          "build",
          environment.processArch,
          executable,
        ),
        ...environment.resolveResourcePathCandidates(relative),
      ];
  for (const candidate of candidates) {
    if (yield* fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false)))
      return candidate;
  }
  return undefined;
});
