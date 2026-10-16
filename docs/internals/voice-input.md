# Voice input

Transcription edits a composer draft. Audio is temporary client input. When the
user chooses to transcribe and send, the mobile composer waits for a successful
draft insertion before invoking normal message submission with its current guards.
Navigation cancels that send intent without discarding the transcript. Transcription
runs locally on supported iOS devices and in the macOS desktop app; environment-backed
transcription is not implemented.

On macOS the desktop shell's [Swift helper](../../native/dictation/main.swift) both
records and transcribes, so recordings are already in a format Apple's speech
framework reads and the renderer never touches audio. The renderer drives the shared controller
through the `dictation` bridge, with recordings named by IDs the main process maps
into its own temporary directory. The helper inherits the app's microphone permission,
so the app and its nested executables both carry the audio-input entitlement.
Recording stops when the helper's stdin closes, which also covers the app exiting.

The [shared controller](../../packages/client-runtime/src/voice-input/controller.ts)
owns the operation while the client supplies capture and transcription. Preparation
binds the transcriber and resolved locale for the whole recording. Draft ownership,
text, and revision are captured before recording and checked before insertion, so
a late transcript cannot overwrite a draft that was edited or replaced.

Cancellation invalidates a result immediately, but resources stay owned until the
underlying work settles. Apple's native transcription call cannot be interrupted
once started. Releasing the session or deleting its recording when the abort signal
fires would race that work. The [transcription contract](../../packages/client-runtime/src/voice-input/transcription.ts)
therefore requires implementations to settle only after their work has stopped;
the [Apple binding](../../apps/mobile/src/native/voiceTranscription.ios.ts) checks
cancellation between native calls and discards late results.
