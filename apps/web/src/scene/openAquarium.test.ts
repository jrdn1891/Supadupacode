import { scopeProjectRef, scopeThreadRef } from "@supacode/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId } from "@supacode/contracts";
import { describe, expect, it } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { selectThreadRightPanelState, useRightPanelStore } from "../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../terminalUiStateStore";
import { openAquarium } from "./openAquarium";
import { scenePanes } from "./scene.logic";
import { useSceneStore } from "./sceneStore";

const environmentId = EnvironmentId.make("environment-local");
const projectRef = scopeProjectRef(environmentId, ProjectId.make("project-aquarium"));
const draftId = DraftId.make("draft-aquarium");
const draftRef = scopeThreadRef(environmentId, ThreadId.make("thread-aquarium"));
const readingRef = scopeThreadRef(environmentId, ThreadId.make("thread-reading"));

describe("openAquarium", () => {
  it("leaves the new thread alone on the stage with its panels closed", async () => {
    useComposerDraftStore
      .getState()
      .setProjectDraftThreadId(projectRef, draftId, { threadId: draftRef.threadId });
    useRightPanelStore.getState().openBrowser(draftRef, "tab-aquarium");
    useTerminalUiStateStore.getState().setTerminalOpen(draftRef, true);
    const stage = useSceneStore.getState();
    stage.syncRoute({ kind: "server", threadRef: readingRef });
    stage.open({ kind: "draft", draftId: DraftId.make("draft-beside") }, "right");
    const focusedPaneId = useSceneStore.getState().scene.focusedPaneId;
    stage.toggleSpotlight(focusedPaneId!);

    await openAquarium({
      activeDraftThread: null,
      activeThread: undefined,
      defaultProjectRef: projectRef,
      handleNewThread: async () => ({ draftId }),
    });

    const { scene } = useSceneStore.getState();
    expect(scenePanes(scene).map((pane) => pane.id)).toEqual([focusedPaneId]);
    expect(scene.spotlightPaneId).toBeNull();
    expect(
      selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, draftRef).isOpen,
    ).toBe(false);
    expect(
      selectThreadTerminalUiState(
        useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
        draftRef,
      ).terminalOpen,
    ).toBe(false);
  });
});
