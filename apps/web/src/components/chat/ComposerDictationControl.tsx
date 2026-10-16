import type { ResolvedKeybindingsConfig } from "@supacode/contracts";
import { MicIcon, SquareIcon, XIcon } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";

import { shortcutLabelForCommand } from "../../keybindings";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { ComposerDictation } from "./useComposerDictation";

const keepEditorFocus = (event: PointerEvent) => event.preventDefault();

function RecordingTime() {
  const [startedAt] = useState(Date.now);
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const seconds = Math.floor((now - startedAt) / 1_000);
  return `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ComposerDictationControl(props: {
  readonly dictation: ComposerDictation;
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly onStart: () => Promise<void>;
}) {
  const { controller, openMicrophoneSettings, state } = props.dictation;
  const shortcut = shortcutLabelForCommand(props.keybindings, "composer.dictate");
  const cancel = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={state.phase === "error" ? "Dismiss" : "Cancel dictation"}
      onPointerDown={keepEditorFocus}
      onClick={() => controller.cancel()}
    >
      <XIcon />
    </Button>
  );

  if (state.phase === "idle" || state.phase === "error") {
    const opensSettings = state.errorAction === "settings";
    const label = opensSettings
      ? "Open microphone settings"
      : state.phase === "error"
        ? "Dictate again"
        : "Dictate";
    return (
      <>
        {state.error === null ? null : (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span role="alert" className="max-w-56 truncate text-destructive text-xs" />
                }
              >
                {state.error}
              </TooltipTrigger>
              <TooltipPopup>{state.error}</TooltipPopup>
            </Tooltip>
            {cancel}
          </>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-composer-shortcut="composer.dictate"
                aria-label={label}
                onPointerDown={keepEditorFocus}
                onClick={() => void (opensSettings ? openMicrophoneSettings() : props.onStart())}
              />
            }
          >
            <MicIcon />
          </TooltipTrigger>
          <TooltipPopup shortcut={shortcut}>{label}</TooltipPopup>
        </Tooltip>
      </>
    );
  }

  return (
    <>
      <span role="status" className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
        {state.phase === "recording" ? (
          <RecordingTime />
        ) : state.phase === "preparing" ? (
          "Preparing…"
        ) : (
          "Transcribing…"
        )}
      </span>
      {cancel}
      {state.phase === "recording" ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                data-composer-shortcut="composer.dictate"
                aria-label="Stop and insert"
                onPointerDown={keepEditorFocus}
                onClick={() => void controller.stop()}
              />
            }
          >
            <SquareIcon className="fill-current" />
          </TooltipTrigger>
          <TooltipPopup shortcut={shortcut}>Stop and insert</TooltipPopup>
        </Tooltip>
      ) : (
        <Spinner size="sm" tone="muted" />
      )}
    </>
  );
}
