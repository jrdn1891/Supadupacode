import {
  type BackstageCue,
  type BackstageEntry,
  backstageDetail,
  backstageEntries,
} from "@supacode/client-runtime/state/backstage";
import type { EnvironmentThreadShell } from "@supacode/client-runtime/state/shell";
import * as Haptics from "expo-haptics";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { type AppSymbolName, SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { DisclosureChevron } from "../../components/DisclosureChevron";
import { resolveThreadListV2Status, threadHasUnseenCompletion } from "./threadListV2";

const CUE_SYMBOL: Readonly<Record<BackstageCue, { icon: AppSymbolName; tint: string }>> = {
  "needs-you": { icon: "exclamationmark.circle", tint: "accent-danger-foreground" },
  ready: { icon: "checkmark.circle.fill", tint: "accent-adaptive-emerald-700-300" },
  standby: { icon: "circle.inset.filled", tint: "accent-warning-foreground" },
  working: { icon: "circle.dashed", tint: "accent-adaptive-sky-600-400" },
};

const SUMMARY_GROUPS: ReadonlyArray<{
  readonly cues: ReadonlyArray<BackstageCue>;
  readonly one: string;
  readonly many: string;
}> = [
  { cues: ["needs-you"], one: "needs you", many: "need you" },
  { cues: ["ready"], one: "ready", many: "ready" },
  { cues: ["standby", "working"], one: "working", many: "working" },
];

function backstageSummary(entries: ReadonlyArray<BackstageEntry>): string {
  return SUMMARY_GROUPS.flatMap(({ cues, one, many }) => {
    const total = entries.filter((entry) => cues.includes(entry.cue)).length;
    return total === 0 ? [] : [`${total} ${total === 1 ? one : many}`];
  }).join(" · ");
}

function useArrivalHaptic(entries: ReadonlyArray<BackstageEntry>) {
  const previous = useRef<ReadonlyMap<string, BackstageCue> | null>(null);
  useEffect(() => {
    const next = new Map(entries.map((entry) => [entry.key, entry.cue]));
    const prior = previous.current;
    previous.current = next;
    if (prior === null) return;
    const arrived = entries.find(
      (entry) =>
        (entry.cue === "needs-you" || entry.cue === "ready") && prior.get(entry.key) !== entry.cue,
    );
    if (arrived === undefined) return;
    void Haptics.notificationAsync(
      arrived.cue === "needs-you"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    );
  }, [entries]);
}

export const BackstageCard = memo(function BackstageCard(props: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly openThreadKey: string | null;
  readonly nowMinute: string;
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
}) {
  const { threads, openThreadKey, nowMinute } = props;
  const entries = useMemo(
    () =>
      backstageEntries({
        threads,
        onStage: (key) => key === openThreadKey,
        status: resolveThreadListV2Status,
        unseen: threadHasUnseenCompletion,
        now: `${nowMinute}:00Z`,
      }),
    [nowMinute, openThreadKey, threads],
  );
  const [expanded, setExpanded] = useState(false);
  useArrivalHaptic(entries);
  const first = entries[0];
  if (first === undefined) return null;
  const nowMs = Date.parse(`${nowMinute}:00Z`);
  return (
    <View className="mx-4 mt-2 mb-1 overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Backstage, ${backstageSummary(entries)}`}
        accessibilityHint={`${expanded ? "Hides" : "Shows"} threads running in the background.`}
        onPress={() => setExpanded((open) => !open)}
        className="flex-row items-center gap-2 px-3 active:bg-subtle"
        style={{ minHeight: 44 }}
      >
        <SymbolView
          name={CUE_SYMBOL[first.cue].icon}
          size={16}
          tintColorClassName={CUE_SYMBOL[first.cue].tint}
        />
        <Text className="text-xs font-supacode-medium text-foreground-muted uppercase">
          Backstage
        </Text>
        <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
          {backstageSummary(entries)}
        </Text>
        <DisclosureChevron
          expanded={expanded}
          size={12}
          tintColorClassName="accent-foreground-muted"
        />
      </Pressable>
      {expanded
        ? entries.map((entry) => (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${entry.thread.title}`}
              onPress={() => props.onSelectThread(entry.thread)}
              className="flex-row items-center gap-2 border-t border-border px-3 active:bg-subtle"
              style={{ minHeight: 44 }}
            >
              <SymbolView
                name={CUE_SYMBOL[entry.cue].icon}
                size={14}
                tintColorClassName={CUE_SYMBOL[entry.cue].tint}
              />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {entry.thread.title}
              </Text>
              <Text className="text-xs text-foreground-muted tabular-nums" numberOfLines={1}>
                {backstageDetail(entry.thread, entry.cue, nowMs)}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
});
