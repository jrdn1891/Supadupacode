import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { resolveNativeHelper } from "../app/NativeHelper.ts";

export const DictationHelperPath = Context.Reference<string | undefined>(
  "@supacode/desktop/dictation/DictationHelperPath",
  { defaultValue: () => undefined },
);

export const layerHelperPath = Layer.effect(
  DictationHelperPath,
  resolveNativeHelper("darwin", "dictation"),
);

export class DictationError extends Schema.TaggedError<DictationError>()("DictationError", {
  command: Schema.String,
  exitCode: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return `Dictation ${this.command} failed.`;
  }
}

export class DesktopDictation extends Context.Service<
  DesktopDictation,
  {
    readonly prepare: Effect.Effect<string | null, DictationError>;
    readonly record: (recording: string, seconds: number) => Effect.Effect<void, DictationError>;
    readonly stop: (recording: string) => Effect.Effect<void>;
    readonly transcribe: (
      recording: string,
      locale: string,
    ) => Effect.Effect<string, DictationError>;
    readonly discard: (recording: string) => Effect.Effect<void>;
  }
>()("@supacode/desktop/dictation/DesktopDictation") {}

export const layer = Layer.effect(
  DesktopDictation,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const helper = yield* DictationHelperPath;
    const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "supacode-dictation-" });
    const recordings = new Map<
      string,
      { readonly stop: Deferred.Deferred<void>; readonly stopped: Deferred.Deferred<void> }
    >();
    const file = (recording: string) => path.join(directory, `${recording}.m4a`);

    const run = Effect.fn("DesktopDictation.run")(function* (
      command: string,
      args: ReadonlyArray<string>,
      stdin: Stream.Stream<Uint8Array> | "ignore" = "ignore",
    ) {
      if (helper === undefined) return yield* new DictationError({ command });
      const { stdout, exitCode } = yield* Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make(helper, [command, ...args], { stdin }),
          );
          const [stdout, , exitCode] = yield* Effect.all(
            [
              handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
              handle.stderr.pipe(Stream.runDrain),
              handle.exitCode,
            ],
            { concurrency: "unbounded" },
          );
          return { stdout, exitCode: Number(exitCode) };
        }),
      ).pipe(Effect.mapError((cause) => new DictationError({ command, cause })));
      if (exitCode !== 0) return yield* new DictationError({ command, exitCode });
      return stdout.trim();
    });

    return DesktopDictation.of({
      prepare: run("prepare", []).pipe(
        Effect.catchIf(
          (error) => error.exitCode === 2,
          () => Effect.succeed(null),
        ),
      ),
      record: Effect.fn("DesktopDictation.record")(function* (recording, seconds) {
        const stop = yield* Deferred.make<void>();
        const stopped = yield* Deferred.make<void>();
        recordings.set(recording, { stop, stopped });
        yield* run(
          "record",
          [file(recording), String(seconds)],
          Stream.fromEffectDrain(Deferred.await(stop)),
        ).pipe(
          Effect.ensuring(
            Effect.suspend(() => {
              recordings.delete(recording);
              return Deferred.succeed(stopped, undefined);
            }),
          ),
        );
      }),
      stop: Effect.fn("DesktopDictation.stop")(function* (recording) {
        const active = recordings.get(recording);
        if (active === undefined) return;
        yield* Deferred.succeed(active.stop, undefined);
        yield* Deferred.await(active.stopped);
      }),
      transcribe: (recording, locale) => run("transcribe", [locale, file(recording)]),
      discard: (recording) =>
        fileSystem.remove(file(recording), { force: true }).pipe(Effect.ignore),
    });
  }),
);
