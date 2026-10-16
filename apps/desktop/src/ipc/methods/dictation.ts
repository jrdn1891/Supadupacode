import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopDictation from "../../dictation/DesktopDictation.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as IpcChannels from "../channels.ts";

const Recording = Schema.String.check(Schema.isUUID());

export const requestMicrophoneAccess = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_REQUEST_MICROPHONE_ACCESS_CHANNEL,
  payload: Schema.Void,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.dictation.requestMicrophoneAccess")(function* () {
    if (Electron.systemPreferences.getMediaAccessStatus("microphone") !== "not-determined") {
      return Electron.systemPreferences.getMediaAccessStatus("microphone") === "granted";
    }
    return yield* Effect.promise(() => Electron.systemPreferences.askForMediaAccess("microphone"));
  }),
});

export const openMicrophoneSettings = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_OPEN_MICROPHONE_SETTINGS_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.dictation.openMicrophoneSettings")(function* () {
    yield* Effect.promise(() =>
      Electron.shell
        .openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
        .catch(() => undefined),
    );
  }),
});

export const prepare = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_PREPARE_CHANNEL,
  payload: Schema.Void,
  result: Schema.NullOr(Schema.String),
  handler: Effect.fn("desktop.ipc.dictation.prepare")(function* () {
    return yield* (yield* DesktopDictation.DesktopDictation).prepare;
  }),
});

export const record = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_RECORD_CHANNEL,
  payload: Schema.Struct({ recording: Recording, seconds: Schema.Number }),
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.dictation.record")(function* ({ recording, seconds }) {
    yield* (yield* DesktopDictation.DesktopDictation).record(recording, seconds);
  }),
});

export const stop = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_STOP_CHANNEL,
  payload: Recording,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.dictation.stop")(function* (recording) {
    yield* (yield* DesktopDictation.DesktopDictation).stop(recording);
  }),
});

export const transcribe = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_TRANSCRIBE_CHANNEL,
  payload: Schema.Struct({ recording: Recording, locale: Schema.String }),
  result: Schema.String,
  handler: Effect.fn("desktop.ipc.dictation.transcribe")(function* ({ recording, locale }) {
    return yield* (yield* DesktopDictation.DesktopDictation).transcribe(recording, locale);
  }),
});

export const discard = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.DICTATION_DISCARD_CHANNEL,
  payload: Recording,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.dictation.discard")(function* (recording) {
    yield* (yield* DesktopDictation.DesktopDictation).discard(recording);
  }),
});
