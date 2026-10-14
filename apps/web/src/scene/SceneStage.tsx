import { useAtomValue } from "@effect/atom-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

import { isCommandPaletteOpen } from "../commandPaletteBus";
import { ThreadRouteView } from "../components/ThreadRouteView";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../components/ui/resizable";
import { SidebarInset } from "../components/ui/sidebar";
import { resolveShortcutCommand } from "../keybindings";
import { isEditableFocused } from "../lib/editableFocus";
import { observeResize } from "../lib/observeResize";
import { isTerminalFocused } from "../lib/terminalFocus";
import { cn } from "../lib/utils";
import { primaryServerKeybindingsAtom } from "../state/server";
import type { ThreadRouteTarget } from "../threadRoutes";
import { findScenePane, type ScenePane, sceneTargetKey, scenePanes } from "./scene.logic";
import { ScenePaneProvider } from "./ScenePaneContext";
import { useSceneStore } from "./sceneStore";
import { useSceneActions } from "./useSceneActions";

const COMPACT_PANE_WIDTH = 720;

export function SceneStage({ target }: { readonly target: ThreadRouteTarget }) {
  const scene = useSceneStore((state) => state.scene);
  const syncRoute = useSceneStore((state) => state.syncRoute);
  const targetKey = sceneTargetKey(target);
  const syncedKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (syncedKey.current === targetKey) return;
    syncedKey.current = targetKey;
    syncRoute(target);
  });

  const split = scenePanes(scene).length > 1;
  const spotlight = findScenePane(scene, scene.spotlightPaneId);
  const columns = spotlight
    ? scene.columns
        .filter((column) => column.panes.includes(spotlight))
        .map((column) => ({ ...column, panes: [spotlight] }))
    : scene.columns;

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh">
      <SceneShortcuts />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {columns.map((column, columnIndex) => (
          <Fragment key={column.id}>
            {columnIndex > 0 ? <ResizableHandle aria-label="Resize stage columns" /> : null}
            <ResizablePanel id={column.id} minSize={240} className="flex">
              <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
                {column.panes.map((pane, paneIndex) => (
                  <Fragment key={pane.id}>
                    {paneIndex > 0 ? (
                      <ResizableHandle orientation="horizontal" aria-label="Resize stage rows" />
                    ) : null}
                    <ResizablePanel id={pane.id} minSize={120} className="flex">
                      <ScenePaneFrame
                        pane={pane}
                        focused={pane.id === scene.focusedPaneId}
                        split={split}
                        spotlit={pane === spotlight}
                        edges={{ left: columnIndex > 0, top: paneIndex > 0 }}
                      />
                    </ResizablePanel>
                  </Fragment>
                ))}
              </ResizablePanelGroup>
            </ResizablePanel>
          </Fragment>
        ))}
      </ResizablePanelGroup>
    </SidebarInset>
  );
}

function ScenePaneFrame({
  pane,
  focused,
  split,
  spotlit,
  edges,
}: {
  readonly pane: ScenePane;
  readonly focused: boolean;
  readonly split: boolean;
  readonly spotlit: boolean;
  readonly edges: { readonly left: boolean; readonly top: boolean };
}) {
  const actions = useSceneActions();
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    if (!split || frame === null) return;
    return observeResize(frame, (entries) => {
      const width = entries.at(-1)?.contentRect.width;
      if (width !== undefined) setNarrow(width <= COMPACT_PANE_WIDTH);
    });
  }, [frame, split]);
  return (
    <div
      ref={setFrame}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col",
        split && "[contain:layout]",
        edges.left && "border-l",
        edges.top && "border-t",
      )}
      data-scene-pane={pane.id}
      onPointerDownCapture={focused ? undefined : () => actions.focus(pane.id)}
    >
      {split && focused && !spotlit ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 bg-primary"
        />
      ) : null}
      <ScenePaneProvider
        paneId={pane.id}
        focused={focused}
        split={split}
        spotlit={spotlit}
        compact={split && narrow}
        portalContainer={split ? frame : null}
      >
        <ThreadRouteView target={pane.target} onLeave={(next) => actions.leave(pane.id, next)} />
      </ScenePaneProvider>
    </div>
  );
}

function SceneShortcuts() {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const actions = useSceneActions();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isCommandPaletteOpen()) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          editableFocus: isEditableFocused(event.target),
        },
      });
      if (scenePanes(useSceneStore.getState().scene).length < 2) return;
      if (command === "stage.closePane") actions.closeFocused();
      else if (command === "stage.toggleSpotlight") actions.toggleFocusedSpotlight();
      else if (command === "stage.focusNext") actions.focusAdjacent(1);
      else if (command === "stage.focusPrevious") actions.focusAdjacent(-1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, keybindings]);
  return null;
}
