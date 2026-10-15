import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef, scopeThreadRef } from "@supacode/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@supacode/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type ProviderApprovalDecision,
  type RuntimeRequestId,
} from "@supacode/contracts";
import { projectScriptCwd } from "@supacode/shared/projectScripts";
import { ArrowUpIcon, ArrowUpRightIcon } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";

import ChatMarkdown from "../components/ChatMarkdown";
import { ComposerPendingApprovalActions } from "../components/chat/ComposerPendingApprovalActions";
import { ComposerPendingApprovalPanel } from "../components/chat/ComposerPendingApprovalPanel";
import { Button } from "../components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../components/ui/input-group";
import { PopoverPopup } from "../components/ui/popover";
import { derivePendingApprovals, derivePendingUserInputs } from "../session-logic";
import { useProject, useThreadProjection } from "../state/entities";
import { useEnvironmentScope } from "../state/session";
import { queueThreadMessage, useThreadOutbox } from "../state/threadOutbox";
import { environmentThreadDetails, threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { type AquariumAgent, agentCueDetail, chatTail } from "./aquariumAgents";

const TAIL = 3;

/** A creature's chat: the agent's latest messages, its pending approval, and a reply field. */
export function AquariumChat(props: {
  readonly agent: AquariumAgent;
  readonly anchor: { readonly getBoundingClientRect: () => DOMRect } | undefined;
  readonly side: "top" | "bottom";
  readonly nowMs: number;
  readonly onOpenThread: () => void;
}) {
  const { thread, cue } = props.agent;
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  const projection = useThreadProjection(ref)?.projection ?? null;
  const requests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(ref));
  const project = useProject(scopeProjectRef(thread.environmentId, thread.projectId));
  const unsent = useThreadOutbox().filter(
    (entry) => entry.scope === props.agent.key && entry.status !== "delivered",
  );
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const respondToApproval = useOrchestrationCommand(threadEnvironment.respondToApproval, {
    reportFailure: false,
  });
  const replyRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = agentCueDetail(thread, cue, props.nowMs);
  const messages = projection?.messages;
  const tail = useMemo(() => chatTail(messages ?? [], TAIL), [messages]);
  const approvals = derivePendingApprovals(requests?.approvals ?? []);
  const approval = approvals[0] ?? null;
  const question = derivePendingUserInputs(requests?.userInputs ?? [])[0]?.questions[0] ?? null;
  const cwd = project
    ? projectScriptCwd({
        project: { cwd: project.workspaceRoot },
        worktreePath: thread.worktreePath,
      })
    : undefined;

  const respond = async (requestId: RuntimeRequestId, decision: ProviderApprovalDecision) => {
    setResponding(true);
    setError(null);
    const result = await respondToApproval({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, requestId, decision },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const failure = squashAtomCommandFailure(result);
      setError(failure instanceof Error ? failure.message : "Failed to submit approval decision.");
    }
    setResponding(false);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text === "") return;
    setDraft("");
    setError(null);
    try {
      await queueThreadMessage(thread.environmentId, {
        threadId: thread.id,
        text,
        runtimeMode: thread.runtimeMode,
        interactionMode: thread.interactionMode,
      });
    } catch (cause) {
      setDraft(text);
      setError(cause instanceof Error ? cause.message : "Could not send the message.");
    }
  };

  return (
    <PopoverPopup
      anchor={props.anchor}
      aria-label={thread.title}
      initialFocus={replyRef}
      padding="none"
      side={props.side}
      sideOffset={8}
      width="md"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{thread.title}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {cue !== "working" ? detail : detail === null ? "Working" : `Working · ${detail}`}
          </p>
        </div>
        <Button size="xs" variant="ghost" onClick={props.onOpenThread}>
          Open
          <ArrowUpRightIcon />
        </Button>
      </div>
      {tail.length > 0 || unsent.length > 0 ? (
        <div className="flex max-h-64 flex-col-reverse overflow-y-auto px-3 pb-2">
          <div className="flex flex-col gap-2">
            {tail.map((message) =>
              message.role === "user" ? (
                <p
                  key={message.id}
                  className="ms-8 self-end rounded-lg bg-secondary px-2.5 py-1.5 text-sm whitespace-pre-wrap wrap-break-word text-secondary-foreground"
                >
                  {message.text}
                </p>
              ) : (
                <ChatMarkdown
                  key={message.id}
                  text={message.text}
                  cwd={cwd}
                  threadRef={ref}
                  environmentId={thread.environmentId}
                  isStreaming={message.streaming}
                />
              ),
            )}
            {unsent.map((entry) => (
              <div key={entry.id} className="ms-8 flex flex-col items-end gap-0.5 self-end">
                <p className="rounded-lg bg-secondary px-2.5 py-1.5 text-sm whitespace-pre-wrap wrap-break-word text-secondary-foreground">
                  {entry.payload.input.message.text}
                </p>
                <span className="text-2xs text-muted-foreground">
                  {entry.status === "failed" ? (entry.error ?? "Not sent") : "Sending…"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {approval ? (
        <div className="flex flex-col gap-2 border-t px-3 py-2.5">
          <ComposerPendingApprovalPanel approval={approval} pendingCount={approvals.length} />
          <div className="flex justify-end gap-1.5">
            <ComposerPendingApprovalActions
              disabled={!canOperate}
              requestId={approval.requestId}
              isResponding={responding}
              options={approval.options}
              canRespond={approval.responseCapability === "live"}
              onRespondToApproval={respond}
            />
          </div>
        </div>
      ) : null}
      {question ? (
        <div className="flex flex-col gap-2 border-t px-3 py-2.5">
          <p className="text-sm">{question.question}</p>
          <div className="flex justify-end">
            <Button size="xs" onClick={props.onOpenThread}>
              Answer in thread
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="px-3 pb-2 text-xs text-destructive-foreground">{error}</p> : null}
      {question ? null : (
        <form className="border-t p-2" onSubmit={send}>
          <InputGroup>
            <InputGroupInput
              ref={replyRef}
              aria-label={`Message ${thread.title}`}
              disabled={!canOperate}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder={cue === "working" || cue === "approval" ? "Queue a message…" : "Reply…"}
              value={draft}
            />
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Send"
                disabled={!canOperate || draft.trim() === ""}
                size="icon-xs"
                type="submit"
              >
                <ArrowUpIcon />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )}
    </PopoverPopup>
  );
}
