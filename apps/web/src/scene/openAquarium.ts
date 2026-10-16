import { scopeThreadRef } from "@supacode/client-runtime/environment";

import { useComposerDraftStore } from "../composerDraftStore";
import {
  type ChatThreadActionContext,
  resolveThreadActionProjectRef,
} from "../lib/chatThreadActions";
import { useRightPanelStore } from "../rightPanelStore";
import { useTerminalUiStateStore } from "../terminalUiStateStore";
import { scenePanes } from "./scene.logic";
import { useSceneStore } from "./sceneStore";

export async function openAquarium(context: ChatThreadActionContext): Promise<void> {
  const projectRef = resolveThreadActionProjectRef(context);
  if (projectRef === null) return;
  const stage = useSceneStore.getState();
  const { scene } = stage;
  if (scene.spotlightPaneId !== null) stage.toggleSpotlight(scene.spotlightPaneId);
  for (const pane of scenePanes(scene)) {
    if (pane.id !== scene.focusedPaneId) stage.close(pane.id);
  }
  const opened = await context.handleNewThread(projectRef);
  const draft = opened && useComposerDraftStore.getState().getDraftSession(opened.draftId);
  if (!draft) return;
  const draftRef = scopeThreadRef(draft.environmentId, draft.threadId);
  useRightPanelStore.getState().close(draftRef);
  useTerminalUiStateStore.getState().setTerminalOpen(draftRef, false);
}
