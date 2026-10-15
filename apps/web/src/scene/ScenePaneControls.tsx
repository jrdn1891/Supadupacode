import { GripVerticalIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Toggle } from "../components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { useShortcutLabel } from "../hooks/useShortcutLabel";
import { sceneThrowCommits } from "./scene.logic";
import { beginSceneDrag } from "./sceneDragGesture";
import { useScenePane } from "./ScenePaneContext";
import { useSceneActions } from "./useSceneActions";

export function ScenePaneControls({ title }: { readonly title: string }) {
  const { paneId, split, spotlit } = useScenePane();
  const actions = useSceneActions();
  const spotlightShortcut = useShortcutLabel("stage.toggleSpotlight");
  const closeShortcut = useShortcutLabel("stage.closePane");
  if (paneId === null || !split) return null;
  return (
    <div className="flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]">
      {spotlit ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                role="button"
                tabIndex={-1}
                aria-label="Move pane"
                className="flex size-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                onPointerDown={(event) =>
                  beginSceneDrag(event, {
                    exceptPaneId: paneId,
                    title,
                    onRelease: ({ target, travelY, velocityY }) => {
                      if (sceneThrowCommits(travelY, velocityY)) {
                        void window.desktopBridge?.performHaptic?.("level-change");
                        actions.close(paneId);
                      } else if (target !== null) actions.move(paneId, target.paneId, target.zone);
                    },
                  })
                }
              />
            }
          >
            <GripVerticalIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">Drag to move, flick down to close</TooltipPopup>
        </Tooltip>
      )}
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
