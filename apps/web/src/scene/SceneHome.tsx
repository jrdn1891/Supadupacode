import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { type BackstageEntry, backstageDetail } from "@supacode/client-runtime/state/backstage";
import { PlusIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Kbd } from "../components/ui/kbd";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { isElectron } from "../env";
import { useStartNewThreadInCurrentProject } from "../hooks/useHandleNewThread";
import { useShortcutLabel } from "../hooks/useShortcutLabel";
import { featuredResident } from "./aquarium.logic";
import { SceneAquarium } from "./SceneAquarium";
import { SceneBackstage } from "./SceneBackstage";
import { useBackstageEntries } from "./useBackstageEntries";
import { useSceneActions } from "./useSceneActions";

export function SceneHome() {
  const { entries, nowMs } = useBackstageEntries(false);
  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh">
      {isElectron ? <WorkspacePageHeader electron /> : null}
      <SceneAquarium entries={entries} nowMs={nowMs}>
        <HomeCopy entries={entries} nowMs={nowMs} />
      </SceneAquarium>
      <SceneBackstage stageVisible={false} />
    </SidebarInset>
  );
}

function HomeCopy({
  entries,
  nowMs,
}: {
  readonly entries: ReadonlyArray<BackstageEntry>;
  readonly nowMs: number;
}) {
  const actions = useSceneActions();
  const startNewThread = useStartNewThreadInCurrentProject();
  const newThreadShortcut = useShortcutLabel("chat.newLocal");
  const featured = featuredResident(entries);
  if (featured !== null) {
    const { thread, cue } = featured;
    return (
      <div className="flex max-w-md min-w-0 flex-col items-center gap-1 text-center">
        <p className="max-w-full truncate text-sm font-medium">{thread.title}</p>
        <p className="text-xs text-muted-foreground">{backstageDetail(thread, cue, nowMs)}</p>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() =>
              actions.open(
                { kind: "server", threadRef: scopeThreadRef(thread.environmentId, thread.id) },
                "right",
              )
            }
          >
            Bring on stage
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-sm font-medium">All quiet</p>
      <p className="text-xs text-muted-foreground">
        {entries.length === 0
          ? "No agents running"
          : `${entries.length} ${entries.length === 1 ? "agent" : "agents"} working · nothing needs you`}
      </p>
      <div className="mt-3">
        <Button variant="glass" size="sm" onClick={() => void startNewThread()}>
          <PlusIcon />
          New thread
          {newThreadShortcut ? <Kbd>{newThreadShortcut}</Kbd> : null}
        </Button>
      </div>
    </div>
  );
}
