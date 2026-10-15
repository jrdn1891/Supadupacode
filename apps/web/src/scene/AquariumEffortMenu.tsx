import { scopeThreadRef } from "@supacode/client-runtime/environment";
import type { EnvironmentThreadShell } from "@supacode/client-runtime/state/models";
import { useMemo, useState } from "react";

import { renderProviderTraitsMenuContent } from "../components/chat/composerProviderState";
import { Menu, MenuDescription, MenuPopup } from "../components/ui/menu";
import {
  deriveEffectiveComposerModelState,
  useComposerDraftStore,
  useComposerThreadDraft,
} from "../composerDraftStore";
import { useEnvironmentSettings } from "../hooks/useSettings";
import { useServerConfigs } from "../state/entities";

export function AquariumEffortMenu(props: {
  readonly thread: EnvironmentThreadShell;
  readonly box: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  readonly onClose: () => void;
}) {
  const { thread } = props;
  const threadRef = useMemo(
    () => scopeThreadRef(thread.environmentId, thread.id),
    [thread.environmentId, thread.id],
  );
  const instanceId = thread.modelSelection.instanceId;
  const providers = useServerConfigs().get(thread.environmentId)?.providers ?? [];
  const provider = providers.find((candidate) => candidate.instanceId === instanceId);
  const settings = useEnvironmentSettings(thread.environmentId);
  const draft = useComposerThreadDraft(threadRef);
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const effective =
    provider &&
    deriveEffectiveComposerModelState({
      draft,
      providers,
      selectedProvider: provider.driver,
      selectedInstanceId: instanceId,
      threadModelSelection: thread.modelSelection,
      projectModelSelection: null,
      settings,
    });
  const traits =
    provider &&
    effective &&
    renderProviderTraitsMenuContent({
      provider: provider.driver,
      instanceId,
      threadRef,
      model: effective.selectedModel,
      models: provider.models,
      modelOptions: effective.modelOptions?.[instanceId],
      prompt: draft.prompt,
      onPromptChange: (prompt) => setPrompt(threadRef, prompt),
    });

  return (
    <>
      <span ref={setAnchor} className="pointer-events-none absolute" style={props.box} />
      <Menu
        open={anchor !== null}
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <MenuPopup anchor={anchor} side="top">
          <MenuDescription>{thread.title}</MenuDescription>
          {traits ?? <MenuDescription>This agent's model has no effort levels.</MenuDescription>}
        </MenuPopup>
      </Menu>
    </>
  );
}
