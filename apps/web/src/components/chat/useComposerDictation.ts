import {
  VoiceInputController,
  VoiceTranscriptionError,
  throwIfVoiceTranscriptionAborted,
  type VoiceInputControllerDependencies,
  type VoiceInputState,
} from "@supacode/client-runtime/voice-input";
import type { DesktopDictationBridge } from "@supacode/contracts";
import { useEffect, useRef, useState } from "react";

import { randomUUID } from "../../lib/utils";

const IDLE_STATE: VoiceInputState = { phase: "idle", error: null, errorAction: null };

export function createDesktopDictationController(
  bridge: DesktopDictationBridge,
  draft: Pick<VoiceInputControllerDependencies, "readDraft" | "commitDraft" | "onStateChange">,
): VoiceInputController {
  let uri: string | null = null;
  const controller: VoiceInputController = new VoiceInputController({
    ...draft,
    recorder: {
      get uri() {
        return uri;
      },
      prepareToRecordAsync: async () => {
        uri = randomUUID();
      },
      record: ({ forDuration }) => {
        const recording = uri;
        if (recording === null) throw new Error("Voice recorder is not prepared.");
        void bridge.record(recording, forDuration).then(
          () =>
            controller.handleRecorderStatus({
              isFinished: true,
              hasError: false,
              error: null,
              url: recording,
            }),
          () =>
            controller.handleRecorderStatus({
              isFinished: false,
              hasError: true,
              error: "Voice recording was interrupted.",
              url: recording,
            }),
        );
      },
      stop: () => (uri === null ? Promise.resolve() : bridge.stop(uri)),
    },
    getTranscriber: () => ({
      prepare: async ({ signal }) => {
        const locale = await bridge.prepare();
        throwIfVoiceTranscriptionAborted(signal);
        if (locale === null) {
          throw new VoiceTranscriptionError(
            "unsupported-locale",
            "Voice transcription does not support this Mac's language.",
          );
        }
        return {
          locale,
          transcribe: async (recording, { signal }) => {
            const text = await bridge.transcribe(recording, locale);
            throwIfVoiceTranscriptionAborted(signal);
            return text;
          },
        };
      },
    }),
    requestPermission: async () => ({
      granted: await bridge.requestMicrophoneAccess(),
      canAskAgain: false,
    }),
    configureRecording: async () => {},
    releaseRecording: async () => {},
    deleteRecording: (recording) => void bridge.discard(recording),
  });
  return controller;
}

export function useComposerDictation(ownerKey: string) {
  const [state, setState] = useState(IDLE_STATE);
  const [dictation] = useState(() => {
    const bridge = window.desktopBridge?.dictation;
    if (!bridge) return null;
    let target: Pick<VoiceInputControllerDependencies, "readDraft" | "commitDraft"> | null = null;
    const controller = createDesktopDictationController(bridge, {
      readDraft: () => target?.readDraft() ?? null,
      commitDraft: (text, selection) => target?.commitDraft(text, selection),
      onStateChange: setState,
    });
    return {
      controller,
      openMicrophoneSettings: bridge.openMicrophoneSettings,
      start: (next: NonNullable<typeof target>) => {
        target = next;
        return controller.start();
      },
    };
  });

  const previousOwnerKey = useRef(ownerKey);
  useEffect(() => {
    if (previousOwnerKey.current === ownerKey) return;
    previousOwnerKey.current = ownerKey;
    dictation?.controller.ownerChanged();
  }, [dictation, ownerKey]);

  useEffect(() => {
    if (!dictation) return;
    const dispose = () => dictation.controller.dispose();
    window.addEventListener("pagehide", dispose);
    return () => {
      window.removeEventListener("pagehide", dispose);
      dispose();
    };
  }, [dictation]);

  return dictation && { ...dictation, state };
}

export type ComposerDictation = NonNullable<ReturnType<typeof useComposerDictation>>;
