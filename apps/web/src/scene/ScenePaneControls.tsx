import { Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Toggle } from "../components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { useShortcutLabel } from "../hooks/useShortcutLabel";
import { useScenePane } from "./ScenePaneContext";
import { useSceneActions } from "./useSceneActions";

export function ScenePaneControls() {
  const { paneId, split, spotlit } = useScenePane();
  const actions = useSceneActions();
  const spotlightShortcut = useShortcutLabel("stage.toggleSpotlight");
  const closeShortcut = useShortcutLabel("stage.closePane");
  if (paneId === null || !split) return null;
  return (
    <div className="flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              pressed={spotlit}
              onPressedChange={() => actions.toggleSpotlight(paneId)}
              aria-label={spotlit ? "Return to the stage" : "Spotlight this thread"}
              variant="ghost"
              size="sm"
            />
          }
        >
          {spotlit ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
        </TooltipTrigger>
        <TooltipPopup side="bottom" shortcut={spotlightShortcut}>
          {spotlit ? "Return to the stage" : "Spotlight"}
        </TooltipPopup>
      </Tooltip>
      {spotlit ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Close pane"
                onClick={() => actions.close(paneId)}
              />
            }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipPopup side="bottom" shortcut={closeShortcut}>
            Close pane
          </TooltipPopup>
        </Tooltip>
      )}
    </div>
  );
}
