import type { EnvironmentId, ProjectId } from "@supacode/contracts";
import { projectContextPatch, resolveProjectContext } from "@supacode/shared/projectSettings";
import { useCallback } from "react";

import type { ThreadActionMenuState } from "../components/threadActionMenu.logic";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentServerConfigsAtom, serverEnvironment } from "../state/server";
import { useAtomCommand } from "../state/use-atom-command";

interface ProjectTarget {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}

function readSettings(environmentId: EnvironmentId) {
  return appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId)?.settings ?? null;
}

export function readProjectContextMenuState(
  target: ProjectTarget,
): ThreadActionMenuState["context"] {
  const settings = readSettings(target.environmentId);
  if (settings === null) return null;
  return {
    current: resolveProjectContext(settings, target.projectId),
    options: settings.projectContexts,
  };
}

export function useSetProjectContext() {
  const updateSettings = useAtomCommand(serverEnvironment.updateSettings, "project context update");
  return useCallback(
    async (target: ProjectTarget, contextId: string | null) => {
      const settings = readSettings(target.environmentId);
      if (settings === null) return;
      await updateSettings({
        environmentId: target.environmentId,
        input: { patch: projectContextPatch(settings, target.projectId, contextId) },
      });
    },
    [updateSettings],
  );
}
