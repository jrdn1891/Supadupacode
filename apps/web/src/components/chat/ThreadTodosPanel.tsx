import { scopeThreadRef } from "@supacode/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@supacode/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type OrchestrationV2ThreadTodo,
  type OrchestrationV2ThreadTodoChange,
  type ThreadId,
} from "@supacode/contracts";
import { BotIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn, randomUUID } from "~/lib/utils";
import { useServerConfigs, useThreadShell } from "~/state/entities";
import { useEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { Checkbox } from "../ui/checkbox";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS,
  THREAD_DETAILS_PANEL_ROW_HEIGHT_CLASS,
  THREAD_DETAILS_PANEL_TEXT_CLASS,
} from "./threadDetailsPanelStyles";

const ROW_CLASS = cn(
  "group/todo flex w-full min-w-0 items-center rounded-lg",
  THREAD_DETAILS_PANEL_ROW_HEIGHT_CLASS,
  THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS,
  THREAD_DETAILS_PANEL_TEXT_CLASS,
);

const INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent outline-none placeholder:font-normal placeholder:text-muted-foreground/60";

export function ThreadTodosPanel(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const threadRef = useMemo(
    () => scopeThreadRef(props.environmentId, props.threadId),
    [props.environmentId, props.threadId],
  );
  const todos = useThreadShell(threadRef)?.todos ?? [];
  const canEdit = useEnvironmentScope(props.environmentId, AuthOrchestrationOperateScope);
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const doneCount = todos.filter((todo) => todo.done).length;

  const change = async (todo: OrchestrationV2ThreadTodoChange) => {
    const result = await updateMetadata({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, todo },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Couldn't update to-dos",
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    }
  };

  return (
    <ThreadDetailsSection
      headingId="thread-details-todos-heading"
      title="To-dos"
      separated={false}
      actions={
        todos.length > 0 ? (
          <>
            {doneCount > 0 && canEdit ? (
              <button
                type="button"
                className="text-2xs text-muted-foreground/70 outline-none hover:text-foreground focus-visible:underline"
                onClick={() => void change({ type: "clear-done" })}
              >
                Clear done
              </button>
            ) : null}
            <span className="text-2xs text-muted-foreground tabular-nums">
              {doneCount}/{todos.length}
            </span>
          </>
        ) : undefined
      }
    >
      <ul className="flex flex-col">
        {todos.map((todo) =>
          editingId === todo.id ? (
            <li key={todo.id}>
              <TodoInput
                initialText={todo.text}
                multiple={false}
                onCommit={(text) => {
                  setEditingId(null);
                  if (text !== todo.text) void change({ type: "edit", todoId: todo.id, text });
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <TodoRow
              key={todo.id}
              environmentId={props.environmentId}
              todo={todo}
              canEdit={canEdit}
              onDoneChange={(done) => void change({ type: "set-done", todoId: todo.id, done })}
              onEdit={() => setEditingId(todo.id)}
              onRemove={() => void change({ type: "remove", todoId: todo.id })}
            />
          ),
        )}
      </ul>
      {!canEdit ? null : adding ? (
        <TodoInput
          initialText=""
          placeholder="Add to-do"
          multiple
          onCommit={(text, keepOpen) => {
            setAdding(keepOpen);
            void change({
              type: "add",
              todoId: randomUUID(),
              text,
              addedBy: "user",
              addedByProviderInstanceId: null,
            });
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <ThreadDetailsControl tone="muted" onClick={() => setAdding(true)}>
          <PlusIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
          Add to-do
        </ThreadDetailsControl>
      )}
    </ThreadDetailsSection>
  );
}

function TodoRow(props: {
  readonly environmentId: EnvironmentId;
  readonly todo: OrchestrationV2ThreadTodo;
  readonly canEdit: boolean;
  readonly onDoneChange: (done: boolean) => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        ROW_CLASS,
        "hover:bg-black/[0.035] dark:hover:bg-white/[0.08] pointer-coarse:h-auto pointer-coarse:min-h-11",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox
          checked={props.todo.done}
          disabled={!props.canEdit}
          onCheckedChange={(checked) => props.onDoneChange(checked === true)}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            props.todo.done && "text-muted-foreground/60 line-through",
          )}
        >
          {props.todo.text}
        </span>
      </label>
      {props.todo.addedBy === "agent" ? (
        <TodoAgentMark
          environmentId={props.environmentId}
          providerInstanceId={props.todo.addedByProviderInstanceId}
        />
      ) : null}
      {props.canEdit ? (
        <span className="flex shrink-0 items-center opacity-0 group-hover/todo:opacity-100 group-focus-within/todo:opacity-100 pointer-coarse:opacity-100">
          <ThreadDetailsControl part="icon" aria-label="Edit to-do" onClick={props.onEdit}>
            <PencilIcon className="size-3.5 text-muted-foreground" />
          </ThreadDetailsControl>
          <ThreadDetailsControl part="icon" aria-label="Remove to-do" onClick={props.onRemove}>
            <XIcon className="size-3.5 text-muted-foreground" />
          </ThreadDetailsControl>
        </span>
      ) : null}
    </li>
  );
}

function TodoAgentMark(props: {
  readonly environmentId: EnvironmentId;
  readonly providerInstanceId: OrchestrationV2ThreadTodo["addedByProviderInstanceId"];
}) {
  const provider = useServerConfigs()
    .get(props.environmentId)
    ?.providers.find((candidate) => candidate.instanceId === props.providerInstanceId);
  const name = provider?.displayName ?? provider?.driver;
  const label = `Added by ${name ?? "an agent"}`;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0" aria-label={label} />}>
        {provider ? (
          <ProviderInstanceIcon
            driverKind={provider.driver}
            displayName={name ?? provider.driver}
            acpRegistryIconUrl={provider.iconUrl}
            iconClassName="size-3.5"
            className="z-auto"
          />
        ) : (
          <BotIcon className="size-3.5 text-muted-foreground" />
        )}
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}

function TodoInput(props: {
  readonly initialText: string;
  readonly placeholder?: string;
  readonly multiple: boolean;
  readonly onCommit: (text: string, keepOpen: boolean) => void;
  readonly onCancel: () => void;
}) {
  const [text, setText] = useState(props.initialText);
  const finished = useRef(false);
  const commit = (keepOpen: boolean) => {
    if (finished.current) return;
    const trimmed = text.trim();
    if (keepOpen && trimmed.length > 0) {
      setText("");
      props.onCommit(trimmed, true);
      return;
    }
    finished.current = true;
    if (trimmed.length > 0) props.onCommit(trimmed, false);
    else props.onCancel();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit(props.multiple);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finished.current = true;
      props.onCancel();
    }
  };
  return (
    <div className={cn(ROW_CLASS, "bg-black/[0.035] dark:bg-white/[0.08]")}>
      <PlusIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
      <input
        autoFocus
        aria-label={props.placeholder ?? "Edit to-do"}
        className={INPUT_CLASS}
        maxLength={200}
        placeholder={props.placeholder}
        value={text}
        onBlur={() => commit(false)}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
