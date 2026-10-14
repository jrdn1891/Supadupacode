import { backstageEntries } from "@supacode/client-runtime/state/backstage";
import { useMemo } from "react";

import {
  hasUnseenCompletion,
  resolveSidebarThreadStatus,
  resolveThreadLastVisitedAt,
} from "../components/Sidebar.logic";
import { useNowMinute } from "../hooks/useNowMinute";
import { useThreadShells } from "../state/entities";
import { useUiStateStore } from "../uiStateStore";
import { sceneTargetKey, scenePanes } from "./scene.logic";
import { useSceneStore } from "./sceneStore";

export function useBackstageEntries(stageVisible: boolean) {
  const threads = useThreadShells();
  const scene = useSceneStore((state) => state.scene);
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const nowMinute = useNowMinute();
  const entries = useMemo(() => {
    const stageKeys = new Set(
      stageVisible ? scenePanes(scene).map((pane) => sceneTargetKey(pane.target)) : [],
    );
    return backstageEntries({
      threads,
      onStage: (key) => stageKeys.has(key),
      status: resolveSidebarThreadStatus,
      unseen: (thread, key) =>
        hasUnseenCompletion({
          ...thread,
          lastVisitedAt: resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisits[key]),
        }),
      now: `${nowMinute}:00Z`,
    });
  }, [localVisits, nowMinute, scene, stageVisible, threads]);
  return { entries, nowMs: Date.parse(`${nowMinute}:00Z`) };
}
