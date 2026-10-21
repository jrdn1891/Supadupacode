import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type OrchestrationV2ThreadTodo,
  type OrchestrationV2ThreadTodoChange,
  type ThreadId,
} from "@supacode/contracts";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import * as Cause from "effect/Cause";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidSheetHeader } from "../../components/AndroidScreenHeader";
import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text, AppTextInput } from "../../components/AppText";
import { ControlPillMenu } from "../../components/ControlPill";
import { showTextInputDialog } from "../../components/ConfirmDialogHost";
import { MaterialScreenContent } from "../../components/MaterialScreenContent";
import { ProviderIcon } from "../../components/ProviderIcon";
import { cn } from "../../lib/cn";
import { uuidv4 } from "../../lib/uuid";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useEnvironmentServerConfig, useThreadShell } from "../../state/entities";
import { useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";

const TODO_TEXT_MAX_LENGTH = 200;

type TodosTarget = { readonly environmentId: EnvironmentId; readonly threadId: ThreadId };

export function ThreadTodosSheet({ route }: StaticScreenProps<TodosTarget>) {
  const { layout } = useAdaptiveWorkspaceLayout();
  const target = route.params;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const thread = useThreadShell(target);
  const todos = thread?.todos ?? [];
  const canOperate = useEnvironmentScope(target.environmentId, AuthOrchestrationOperateScope);
  const providers = useEnvironmentServerConfig(target.environmentId)?.providers ?? [];
  const updateMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const [draft, setDraft] = useState("");

  const change = (todo: OrchestrationV2ThreadTodoChange) => {
    void Haptics.selectionAsync();
    void updateMetadata({
      environmentId: target.environmentId,
      input: { threadId: target.threadId, todo },
    }).then((result) => {
      if (result._tag === "Success") return;
      const error = Cause.squash(result.cause);
      Alert.alert(
        "Could not update to-dos",
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "The to-do list could not be changed.",
      );
    });
  };

  const addDraft = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft("");
    change({
      type: "add",
      todoId: uuidv4(),
      text,
      addedBy: "user",
      addedByProviderInstanceId: null,
    });
  };

  const editTodo = (todo: OrchestrationV2ThreadTodo) => {
    const commit = (value: string) => {
      const text = value.trim();
      if (text.length === 0 || text === todo.text) return;
      change({ type: "edit", todoId: todo.id, text: text.slice(0, TODO_TEXT_MAX_LENGTH) });
    };
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Edit to-do",
        undefined,
        (value) => commit(value ?? ""),
        "plain-text",
        todo.text,
      );
      return;
    }
    showTextInputDialog({
      title: "Edit to-do",
      initialValue: todo.text,
      confirmText: "Save",
      onConfirm: commit,
    });
  };

  const hasDone = todos.some((todo) => todo.done);

  const content = (
    <ScrollView
      nestedScrollEnabled
      className="flex-1"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      contentContainerClassName="px-5 pb-6"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
    >
      {Platform.OS === "ios" ? (
        <View className="mb-2 flex-row items-center gap-2 pt-7">
          <Text accessibilityRole="header" className="text-lg font-supacode-bold text-foreground">
            To-dos
          </Text>
          {todos.length > 0 ? (
            <Text className="text-base tabular-nums text-foreground-muted">
              {todos.filter((todo) => todo.done).length}/{todos.length}
            </Text>
          ) : null}
        </View>
      ) : null}
      {todos.map((todo) => (
        <ThreadTodoRow
          key={todo.id}
          todo={todo}
          canOperate={canOperate}
          provider={
            todo.addedBy === "agent"
              ? (providers.find(
                  (provider) => provider.instanceId === todo.addedByProviderInstanceId,
                ) ?? null)
              : null
          }
          onToggle={() => change({ type: "set-done", todoId: todo.id, done: !todo.done })}
          onEdit={() => editTodo(todo)}
          onRemove={() => change({ type: "remove", todoId: todo.id })}
        />
      ))}
      {canOperate ? (
        <View className="min-h-11 flex-row items-center gap-3 border-b border-border py-1">
          <SymbolView
            name="plus"
            size={16}
            tintColorClassName="accent-foreground-muted"
            type="monochrome"
          />
          <AppTextInput
            accessibilityLabel="Add to-do"
            className="min-h-11 min-w-0 flex-1 text-base text-foreground"
            placeholder="Add to-do"
            value={draft}
            maxLength={TODO_TEXT_MAX_LENGTH}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            submitBehavior="submit"
            returnKeyType="done"
          />
        </View>
      ) : todos.length === 0 ? (
        <Text className="pt-6 text-center text-sm text-foreground-muted">No to-dos.</Text>
      ) : null}
      {canOperate && hasDone ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => change({ type: "clear-done" })}
          className="self-end py-3 active:opacity-70"
        >
          <Text className="text-sm text-foreground-muted">Clear done</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  if (Platform.OS === "ios") {
    return (
      <View collapsable={false} className="flex-1 bg-sheet">
        {content}
      </View>
    );
  }

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <NativeStackScreenOptions options={{ sheetCornerRadius: 28 }} />
      <AndroidSheetHeader title="To-dos" onBack={() => navigation.goBack()} />
      <MaterialScreenContent insetHorizontal={layout.usesSplitView}>
        {content}
      </MaterialScreenContent>
    </View>
  );
}

function ThreadTodoRow(props: {
  readonly todo: OrchestrationV2ThreadTodo;
  readonly canOperate: boolean;
  readonly provider: { readonly driver: string; readonly iconUrl?: string | null } | null;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  const { todo } = props;
  const row = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={todo.text}
      accessibilityHint={props.canOperate ? "Touch and hold to edit or delete." : undefined}
      accessibilityState={{ checked: todo.done, disabled: !props.canOperate }}
      accessibilityActions={
        props.canOperate
          ? [
              { name: "edit", label: "Edit" },
              { name: "delete", label: "Delete" },
            ]
          : undefined
      }
      onAccessibilityAction={({ nativeEvent }) =>
        nativeEvent.actionName === "edit" ? props.onEdit() : props.onRemove()
      }
      disabled={!props.canOperate}
      onPress={props.onToggle}
      className="min-h-11 flex-row items-center gap-3 border-b border-border py-2.5 active:opacity-70"
    >
      <View
        className={cn(
          "size-[18px] items-center justify-center rounded-[5px]",
          todo.done ? "bg-foreground-muted" : "border-[1.5px] border-foreground-muted",
        )}
      >
        {todo.done ? (
          <SymbolView
            name="checkmark"
            size={12}
            tintColorClassName="accent-sheet"
            type="monochrome"
            weight="bold"
          />
        ) : null}
      </View>
      <Text
        className={cn("flex-1 text-base", todo.done ? "text-foreground-muted" : "text-foreground")}
        style={todo.done ? { textDecorationLine: "line-through" } : undefined}
      >
        {todo.text}
      </Text>
      {todo.addedBy === "agent" ? (
        props.provider ? (
          <ProviderIcon
            provider={props.provider.driver}
            iconUrl={props.provider.iconUrl}
            size={14}
          />
        ) : (
          <SymbolView
            name="sparkles"
            size={14}
            tintColorClassName="accent-foreground-muted"
            type="monochrome"
          />
        )
      ) : null}
    </Pressable>
  );
  if (!props.canOperate) return row;
  return (
    <ControlPillMenu
      shouldOpenOnLongPress
      actions={[
        { id: "edit", title: "Edit", image: Platform.OS === "ios" ? "pencil" : "edit" },
        {
          id: "delete",
          title: "Delete",
          image: Platform.OS === "ios" ? "trash" : undefined,
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) =>
        nativeEvent.event === "edit" ? props.onEdit() : props.onRemove()
      }
    >
      {row}
    </ControlPillMenu>
  );
}
