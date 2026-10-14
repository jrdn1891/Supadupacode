import { scopeThreadRef } from "@supacode/client-runtime/environment";
import { backstageDetail } from "@supacode/client-runtime/state/backstage";
import type { DesktopBackstageItem, EnvironmentId, ThreadId } from "@supacode/contracts";
import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { useBackstageEntries } from "./useBackstageEntries";
import { useSceneActions } from "./useSceneActions";

const TRAY_LIMIT = 20;

export function BackstageTraySync() {
  const { threadId, draftId } = useParams({ strict: false });
  const { entries, nowMs } = useBackstageEntries(threadId !== undefined || draftId !== undefined);
  const actions = useSceneActions();
  const items = useMemo(
    () =>
      entries.slice(0, TRAY_LIMIT).map(({ thread, cue }): DesktopBackstageItem => ({
        environmentId: thread.environmentId,
        threadId: thread.id,
        title: thread.title.slice(0, 200),
        cue,
        detail: backstageDetail(thread, cue, nowMs),
      })),
    [entries, nowMs],
  );
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const payload = JSON.stringify(items);
    if (payload === sent.current) return;
    sent.current = payload;
    void window.desktopBridge?.setBackstageSummary?.(items);
  }, [items]);
  useEffect(
    () =>
      window.desktopBridge?.onBackstageOpen?.((thread) =>
        actions.open(
          {
            kind: "server",
            threadRef: scopeThreadRef(
              thread.environmentId as EnvironmentId,
              thread.threadId as ThreadId,
            ),
          },
          "right",
        ),
      ),
    [actions],
  );
  return null;
}
