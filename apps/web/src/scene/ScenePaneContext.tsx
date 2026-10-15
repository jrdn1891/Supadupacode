import { createContext, use, useMemo, useRef, type ReactNode } from "react";

import type { ChatComposerHandle } from "../components/chat/ChatComposer";
import { ComposerHandleContext, useComposerHandleContext } from "../composerHandleContext";

export interface ScenePaneState {
  readonly paneId: string | null;
  readonly focused: boolean;
  readonly split: boolean;
  readonly spotlit: boolean;
  readonly compact: boolean;
  readonly portalContainer: HTMLElement | null;
}

const SOLO_PANE: ScenePaneState = {
  paneId: null,
  focused: true,
  split: false,
  spotlit: false,
  compact: false,
  portalContainer: null,
};

const ScenePaneContext = createContext<ScenePaneState>(SOLO_PANE);

export function useScenePane(): ScenePaneState {
  return use(ScenePaneContext);
}

export function ScenePaneProvider({
  paneId,
  focused,
  split,
  spotlit,
  compact,
  portalContainer,
  children,
}: ScenePaneState & { readonly children: ReactNode }) {
  const appComposerRef = useComposerHandleContext();
  const paneComposerRef = useRef<ChatComposerHandle | null>(null);
  const pane = useMemo(
    () => ({ paneId, focused, split, spotlit, compact, portalContainer }),
    [paneId, focused, split, spotlit, compact, portalContainer],
  );
  return (
    <ScenePaneContext value={pane}>
      <ComposerHandleContext value={focused && appComposerRef ? appComposerRef : paneComposerRef}>
        {children}
      </ComposerHandleContext>
    </ScenePaneContext>
  );
}
