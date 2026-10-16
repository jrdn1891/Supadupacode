import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import * as DesktopDictation from "./DesktopDictation.ts";

const FAKE_HELPER = `#!/bin/sh
case "$1" in
  prepare) [ -e "$0.unsupported" ] && exit 2; echo en-GB ;;
  record) cat > /dev/null; printf 'hello there' > "$2" ;;
  transcribe) cat "$3" ;;
esac
`;

const withDictation = <A, E>(
  test: (input: {
    readonly dictation: DesktopDictation.DesktopDictation["Service"];
    readonly helper: string;
  }) => Effect.Effect<A, E, FileSystem.FileSystem>,
) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "supacode-dictation-test-",
    });
    const helper = path.join(directory, "supacode-dictation");
    yield* fileSystem.writeFileString(helper, FAKE_HELPER);
    yield* fileSystem.chmod(helper, 0o755);
    return yield* DesktopDictation.DesktopDictation.pipe(
      Effect.flatMap((dictation) => test({ dictation, helper })),
      Effect.provide(
        DesktopDictation.layer.pipe(
          Layer.provide(Layer.succeed(DesktopDictation.DictationHelperPath, helper)),
        ),
      ),
    );
  });

it.layer(NodeServices.layer)("DesktopDictation", (it) => {
  it.effect("prepares the system language, or reports that it has no speech model", () =>
    withDictation(({ dictation, helper }) =>
      Effect.gen(function* () {
        assert.equal(yield* dictation.prepare, "en-GB");
        yield* (yield* FileSystem.FileSystem).writeFileString(`${helper}.unsupported`, "");
        assert.isNull(yield* dictation.prepare);
      }),
    ),
  );

  it.effect("records until stopped, transcribes the recording, then discards it", () =>
    withDictation(({ dictation }) =>
      Effect.gen(function* () {
        const recording = "6f1c2b1e-8d4f-4d7a-9a3e-2b5c7d9e0f1a";
        const recorder = yield* Effect.forkChild(dictation.record(recording, 300), {
          startImmediately: true,
        });
        yield* dictation.stop(recording);
        assert.isUndefined(yield* Fiber.join(recorder));
        assert.equal(yield* dictation.transcribe(recording, "en-GB"), "hello there");

        yield* dictation.discard(recording);
        const error = yield* dictation.transcribe(recording, "en-GB").pipe(Effect.flip);
        assert.equal(error.command, "transcribe");
        assert.notEqual(error.exitCode, 0);
      }),
    ),
  );
});
