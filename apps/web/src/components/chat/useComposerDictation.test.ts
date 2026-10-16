import type { VoiceInputState } from "@supacode/client-runtime/voice-input";
import type { DesktopDictationBridge } from "@supacode/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { createDesktopDictationController } from "./useComposerDictation";

function fakeBridge(overrides: Partial<DesktopDictationBridge> = {}) {
  const recordings = new Map<string, () => void>();
  const bridge = {
    requestMicrophoneAccess: vi.fn(async () => true),
    openMicrophoneSettings: vi.fn(async () => {}),
    prepare: vi.fn(async (): Promise<string | null> => "en-GB"),
    record: vi.fn(
      (recording: string) =>
        new Promise<void>((resolve) => {
          recordings.set(recording, resolve);
        }),
    ),
    stop: vi.fn(async (recording: string) => recordings.get(recording)?.()),
    transcribe: vi.fn(async () => "the login"),
    discard: vi.fn(async () => {}),
    ...overrides,
  };
  const reachTimeLimit = () => [...recordings.values()].forEach((finish) => finish());
  return { bridge, reachTimeLimit };
}

function dictate(bridge: DesktopDictationBridge) {
  const committed: string[] = [];
  const settled = Promise.withResolvers<VoiceInputState>();
  const controller = createDesktopDictationController(bridge, {
    readDraft: () => ({
      ownerKey: "draft",
      text: "Fix  bug",
      selection: { start: 4, end: 4 },
      revision: 0,
    }),
    commitDraft: (text) => committed.push(text),
    onStateChange: (state) => {
      if (state.phase === "idle" || state.phase === "error") settled.resolve(state);
    },
  });
  return { controller, committed, settled: settled.promise };
}

describe("desktop dictation", () => {
  it("inserts the transcript at the caret and discards the recording", async () => {
    const { bridge } = fakeBridge();
    const { controller, committed } = dictate(bridge);

    await controller.start();
    expect(controller.currentState.phase).toBe("recording");
    await controller.stop();

    expect(committed).toEqual(["Fix the login bug"]);
    const [recording] = vi.mocked(bridge.record).mock.calls[0]!;
    expect(bridge.transcribe).toHaveBeenCalledWith(recording, "en-GB");
    expect(bridge.discard).toHaveBeenCalledWith(recording);
  });

  it("transcribes once the recording reaches its time limit", async () => {
    const { bridge, reachTimeLimit } = fakeBridge();
    const { controller, committed, settled } = dictate(bridge);

    await controller.start();
    reachTimeLimit();

    expect((await settled).phase).toBe("idle");
    expect(committed).toEqual(["Fix the login bug"]);
    expect(bridge.stop).not.toHaveBeenCalled();
  });

  it("explains when the Mac's language has no speech model", async () => {
    const { bridge } = fakeBridge({ prepare: async () => null });
    const { controller, settled } = dictate(bridge);

    await controller.start();

    expect(await settled).toEqual({
      phase: "error",
      error: "Voice transcription is not available for this language.",
      errorAction: "retry",
    });
    expect(bridge.record).not.toHaveBeenCalled();
  });

  it("points to System Settings when microphone access is denied", async () => {
    const { bridge } = fakeBridge({ requestMicrophoneAccess: async () => false });
    const { controller, settled } = dictate(bridge);

    await controller.start();

    expect(await settled).toMatchObject({ phase: "error", errorAction: "settings" });
  });
});
