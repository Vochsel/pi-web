export type PiThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type PiStreamingBehavior = "steer" | "followUp";

export type PiSessionStatus =
  | "disconnected"
  | "starting"
  | "idle"
  | "streaming"
  | "stopped"
  | "error";

export interface PiTextContent {
  type: "text";
  text: string;
}

export interface PiImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface PiThinkingContent {
  type: "thinking";
  thinking: string;
}

export interface PiToolCallContent {
  type: "toolCall";
  id: string;
  name: string;
  arguments?: unknown;
}

export type PiStructuredContent =
  | PiTextContent
  | PiImageContent
  | PiThinkingContent
  | PiToolCallContent
  | Record<string, unknown>;

export type PiMessageContent = string | PiStructuredContent[];

export interface PiUserMessage {
  role: "user";
  content: PiMessageContent;
  timestamp: number;
  attachments?: unknown[];
}

export interface PiAssistantUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

export interface PiAssistantMessage {
  role: "assistant";
  content: PiStructuredContent[];
  api?: string;
  provider?: string;
  model?: string;
  usage?: PiAssistantUsage;
  stopReason?: "stop" | "length" | "toolUse" | "error" | "aborted" | string;
  timestamp: number;
  responseId?: string;
  errorMessage?: string;
}

export interface PiToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: PiStructuredContent[];
  isError: boolean;
  timestamp: number;
}

export interface PiBashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string | null;
  timestamp: number;
}

export type PiAgentMessage =
  | PiUserMessage
  | PiAssistantMessage
  | PiToolResultMessage
  | PiBashExecutionMessage;

export type PiAssistantMessageEvent =
  | {
      type: "start";
      partial?: PiAssistantMessage;
    }
  | {
      type: "text_start";
      contentIndex: number;
      partial?: PiAssistantMessage;
    }
  | {
      type: "text_delta";
      contentIndex: number;
      delta: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "text_end";
      contentIndex: number;
      content: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "thinking_start";
      contentIndex: number;
      partial?: PiAssistantMessage;
    }
  | {
      type: "thinking_delta";
      contentIndex: number;
      delta: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "thinking_end";
      contentIndex: number;
      content: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "toolcall_start";
      contentIndex: number;
      partial?: PiAssistantMessage;
    }
  | {
      type: "toolcall_delta";
      contentIndex: number;
      delta: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "toolcall_end";
      contentIndex: number;
      toolCall?: PiToolCallContent;
      partial?: PiAssistantMessage;
    }
  | {
      type: "done";
      reason?: string;
      partial?: PiAssistantMessage;
    }
  | {
      type: "error";
      reason?: string;
      partial?: PiAssistantMessage;
    };

export interface PiModelInfo {
  id: string;
  name?: string;
  api?: string;
  provider?: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: Record<string, number>;
}

export interface PiRpcSessionState {
  model?: PiModelInfo | null;
  thinkingLevel?: PiThinkingLevel | string;
  isStreaming?: boolean;
  isCompacting?: boolean;
  steeringMode?: "all" | "one-at-a-time" | string;
  followUpMode?: "all" | "one-at-a-time" | string;
  sessionFile?: string;
  sessionId?: string;
  sessionName?: string;
  autoCompactionEnabled?: boolean;
  messageCount?: number;
  pendingMessageCount?: number;
  [key: string]: unknown;
}

export interface PiSessionStats {
  sessionFile?: string;
  sessionId?: string;
  userMessages?: number;
  assistantMessages?: number;
  toolCalls?: number;
  toolResults?: number;
  totalMessages?: number;
  cost?: number;
  contextUsage?: {
    tokens?: number | null;
    contextWindow?: number | null;
    percent?: number | null;
  };
  [key: string]: unknown;
}

export interface PiPromptRequest {
  sessionId: string;
  message: string;
  images?: PiImageContent[];
  command?: "prompt" | "steer" | "follow_up";
  streamingBehavior?: PiStreamingBehavior;
}

export interface PiAbortRequest {
  sessionId: string;
}

export interface PiCommandAck {
  sessionId: string;
  accepted: boolean;
}

export interface PiBaseCommand {
  id?: string;
  type: string;
  [key: string]: unknown;
}

export interface PiPromptCommand extends PiBaseCommand {
  type: "prompt";
  message: string;
  images?: PiImageContent[];
  streamingBehavior?: PiStreamingBehavior;
}

export interface PiSteerCommand extends PiBaseCommand {
  type: "steer";
  message: string;
  images?: PiImageContent[];
}

export interface PiFollowUpCommand extends PiBaseCommand {
  type: "follow_up";
  message: string;
  images?: PiImageContent[];
}

export interface PiAbortCommand extends PiBaseCommand {
  type: "abort";
}

export interface PiGetStateCommand extends PiBaseCommand {
  type: "get_state";
}

export interface PiGetMessagesCommand extends PiBaseCommand {
  type: "get_messages";
}

export interface PiGetSessionStatsCommand extends PiBaseCommand {
  type: "get_session_stats";
}

export interface PiNewSessionCommand extends PiBaseCommand {
  type: "new_session";
  parentSession?: string;
}

export interface PiSetModelCommand extends PiBaseCommand {
  type: "set_model";
  provider: string;
  modelId: string;
}

export type PiRpcCommand =
  | PiPromptCommand
  | PiSteerCommand
  | PiFollowUpCommand
  | PiAbortCommand
  | PiGetStateCommand
  | PiGetMessagesCommand
  | PiGetSessionStatsCommand
  | PiNewSessionCommand
  | PiSetModelCommand
  | PiBaseCommand;

export type PiRpcCommandInput = PiRpcCommand extends infer T
  ? T extends unknown
    ? Omit<T, "id">
    : never
  : never;

export interface PiRpcSuccessResponse<TData = unknown> {
  id?: string;
  type: "response";
  command: string;
  success: true;
  data?: TData;
}

export interface PiRpcErrorResponse {
  id?: string;
  type: "response";
  command: string;
  success: false;
  error: string;
}

export type PiRpcResponse<TData = unknown> =
  | PiRpcSuccessResponse<TData>
  | PiRpcErrorResponse;

export interface PiAgentStartEvent {
  type: "agent_start";
}

export interface PiAgentEndEvent {
  type: "agent_end";
  messages?: PiAgentMessage[];
}

export interface PiTurnStartEvent {
  type: "turn_start";
}

export interface PiTurnEndEvent {
  type: "turn_end";
  message?: PiAssistantMessage;
  toolResults?: PiToolResultMessage[];
}

export interface PiMessageStartEvent {
  type: "message_start";
  message: PiAgentMessage;
}

export interface PiMessageUpdateEvent {
  type: "message_update";
  message: PiAssistantMessage;
  assistantMessageEvent: PiAssistantMessageEvent;
}

export interface PiMessageEndEvent {
  type: "message_end";
  message: PiAgentMessage;
}

export interface PiToolExecutionStartEvent {
  type: "tool_execution_start";
  toolCallId?: string;
  toolName?: string;
  toolCall?: PiToolCallContent;
  [key: string]: unknown;
}

export interface PiToolExecutionUpdateEvent {
  type: "tool_execution_update";
  toolCallId?: string;
  toolName?: string;
  toolCall?: PiToolCallContent;
  partialResult?: unknown;
  [key: string]: unknown;
}

export interface PiToolExecutionEndEvent {
  type: "tool_execution_end";
  toolCallId?: string;
  toolName?: string;
  toolCall?: PiToolCallContent;
  result?: unknown;
  isError?: boolean;
  [key: string]: unknown;
}

export type PiRpcEvent =
  | PiAgentStartEvent
  | PiAgentEndEvent
  | PiTurnStartEvent
  | PiTurnEndEvent
  | PiMessageStartEvent
  | PiMessageUpdateEvent
  | PiMessageEndEvent
  | PiToolExecutionStartEvent
  | PiToolExecutionUpdateEvent
  | PiToolExecutionEndEvent;

export interface PiProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
}

export interface PiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  timestamp: number;
  status: "streaming" | "complete" | "aborted" | "error";
  stopReason?: string;
}

export interface PiToolCallState {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  output: string;
  status: "running" | "complete" | "error";
  updatedAt: string;
}

export interface PiUiState {
  sessionId: string;
  status: PiSessionStatus;
  messages: PiChatMessage[];
  tools: PiToolCallState[];
  lastError?: string;
  lastEventAt?: string;
  activeAssistantMessageId?: string;
}

export type PiUiEvent =
  | {
      type: "session.status";
      sessionId: string;
      status: PiSessionStatus;
      at: string;
      reason?: string;
    }
  | {
      type: "session.error";
      sessionId: string;
      at: string;
      source: "process" | "parse" | "rpc";
      message: string;
    }
  | {
      type: "agent.started";
      sessionId: string;
      at: string;
    }
  | {
      type: "agent.ended";
      sessionId: string;
      at: string;
      messages?: PiAgentMessage[];
    }
  | {
      type: "message.started";
      sessionId: string;
      at: string;
      message: PiAgentMessage;
    }
  | {
      type: "message.delta";
      sessionId: string;
      at: string;
      message: PiAssistantMessage;
      assistantEvent: PiAssistantMessageEvent;
    }
  | {
      type: "message.completed";
      sessionId: string;
      at: string;
      message: PiAgentMessage;
    }
  | {
      type: "tool.started";
      sessionId: string;
      at: string;
      toolCallId: string;
      toolName: string;
      args?: unknown;
    }
  | {
      type: "tool.updated";
      sessionId: string;
      at: string;
      toolCallId: string;
      toolName: string;
      output?: string;
    }
  | {
      type: "tool.completed";
      sessionId: string;
      at: string;
      toolCallId: string;
      toolName: string;
      output?: string;
      isError: boolean;
    };

export type PiTransportEvent =
  | {
      type: "snapshot";
      snapshot: PiUiState;
    }
  | PiUiEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStructuredList(content: PiMessageContent): PiStructuredContent[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  return content;
}

function readTextBlock(block: PiStructuredContent): string {
  if (!isRecord(block) || typeof block.type !== "string") {
    return "";
  }

  if (block.type === "text" && typeof block.text === "string") {
    return block.text;
  }

  return "";
}

function readThinkingBlock(block: PiStructuredContent): string {
  if (!isRecord(block) || typeof block.type !== "string") {
    return "";
  }

  if (block.type === "thinking" && typeof block.thinking === "string") {
    return block.thinking;
  }

  return "";
}

function withLastEvent(state: PiUiState, at: string): PiUiState {
  return {
    ...state,
    lastEventAt: at,
  };
}

function resolveMessageId(message: PiAgentMessage): string {
  if ("responseId" in message && typeof message.responseId === "string") {
    return message.responseId;
  }

  return `${message.role}:${message.timestamp}`;
}

function deriveMessageStatus(
  message: PiAgentMessage,
): PiChatMessage["status"] | null {
  if (message.role !== "assistant") {
    return "complete";
  }

  if (message.stopReason === "aborted") {
    return "aborted";
  }

  if (message.stopReason === "error") {
    return "error";
  }

  return "complete";
}

function projectChatMessage(
  message: PiAgentMessage,
  statusOverride?: PiChatMessage["status"],
): PiChatMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }

  const text =
    flattenPiMessageText(message) ||
    ("errorMessage" in message && typeof message.errorMessage === "string"
      ? message.errorMessage
      : "");

  return {
    id: resolveMessageId(message),
    role: message.role,
    text,
    thinking:
      message.role === "assistant" ? extractPiThinking(message.content) : undefined,
    timestamp: message.timestamp,
    status: statusOverride ?? deriveMessageStatus(message) ?? "complete",
    stopReason: message.role === "assistant" ? message.stopReason : undefined,
  };
}

function upsertMessage(
  messages: PiChatMessage[],
  nextMessage: PiChatMessage,
): PiChatMessage[] {
  const nextMessages = messages.slice();
  const existingIndex = nextMessages.findIndex(
    (message) => message.id === nextMessage.id,
  );

  if (existingIndex === -1) {
    nextMessages.push(nextMessage);
    return nextMessages.sort((left, right) => left.timestamp - right.timestamp);
  }

  nextMessages[existingIndex] = {
    ...nextMessages[existingIndex],
    ...nextMessage,
  };

  return nextMessages;
}

function upsertTool(
  tools: PiToolCallState[],
  nextTool: PiToolCallState,
): PiToolCallState[] {
  const nextTools = tools.slice();
  const existingIndex = nextTools.findIndex(
    (tool) => tool.toolCallId === nextTool.toolCallId,
  );

  if (existingIndex === -1) {
    nextTools.push(nextTool);
    return nextTools.sort((left, right) =>
      left.updatedAt.localeCompare(right.updatedAt),
    );
  }

  nextTools[existingIndex] = {
    ...nextTools[existingIndex],
    ...nextTool,
  };

  return nextTools;
}

function ensureAssistantMessage(
  state: PiUiState,
  message: PiAssistantMessage,
): PiUiState {
  const projected = projectChatMessage(message, "streaming");

  if (!projected) {
    return state;
  }

  return {
    ...state,
    activeAssistantMessageId: projected.id,
    messages: upsertMessage(state.messages, projected),
  };
}

function resolveActiveAssistantId(
  state: PiUiState,
  message: PiAssistantMessage,
): string {
  return state.activeAssistantMessageId ?? resolveMessageId(message);
}

function appendIfPresent(base: string, extra?: string): string {
  if (!extra) {
    return base;
  }

  return `${base}${extra}`;
}

function stringifyToolPayload(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((entry) => stringifyToolPayload(entry)).join("");
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.content)) {
      return payload.content
        .map((entry) => stringifyToolPayload(entry))
        .filter(Boolean)
        .join("");
    }

    if (typeof payload.text === "string") {
      return payload.text;
    }

    if (typeof payload.output === "string") {
      return payload.output;
    }
  }

  return JSON.stringify(payload);
}

function resolveToolIdentity(event: {
  toolCallId?: string;
  toolName?: string;
  toolCall?: PiToolCallContent;
  args?: unknown;
  arguments?: unknown;
}): {
  toolCallId: string;
  toolName: string;
  args?: unknown;
} {
  const toolCallId = event.toolCall?.id ?? event.toolCallId ?? "unknown-tool-call";
  const toolName = event.toolCall?.name ?? event.toolName ?? "unknown-tool";
  const args = event.toolCall?.arguments ?? event.args ?? event.arguments;

  return { toolCallId, toolName, args };
}

export function flattenPiContentText(content: PiMessageContent): string {
  return asStructuredList(content)
    .map((block) => readTextBlock(block))
    .filter(Boolean)
    .join("");
}

export function flattenPiMessageText(message: PiAgentMessage): string {
  if (message.role === "bashExecution") {
    return message.output;
  }

  return flattenPiContentText(message.content);
}

export function extractPiThinking(content: PiStructuredContent[]): string {
  return content.map((block) => readThinkingBlock(block)).filter(Boolean).join("");
}

export function createPiUiState(sessionId: string): PiUiState {
  return {
    sessionId,
    status: "disconnected",
    messages: [],
    tools: [],
  };
}

export function reducePiTransportEvent(
  state: PiUiState,
  event: PiTransportEvent,
): PiUiState {
  if (event.type === "snapshot") {
    return event.snapshot;
  }

  switch (event.type) {
    case "session.status":
      return {
        ...withLastEvent(state, event.at),
        sessionId: event.sessionId,
        status: event.status,
      };

    case "session.error":
      return {
        ...withLastEvent(state, event.at),
        sessionId: event.sessionId,
        status: "error",
        lastError: event.message,
      };

    case "agent.started":
      return {
        ...withLastEvent(state, event.at),
        sessionId: event.sessionId,
        status: "streaming",
      };

    case "agent.ended":
      return {
        ...withLastEvent(state, event.at),
        sessionId: event.sessionId,
        status: "idle",
        activeAssistantMessageId: undefined,
      };

    case "message.started": {
      const projected =
        event.message.role === "assistant"
          ? projectChatMessage(event.message, "streaming")
          : projectChatMessage(event.message);

      if (!projected) {
        return withLastEvent(state, event.at);
      }

      return {
        ...withLastEvent(state, event.at),
        messages: upsertMessage(state.messages, projected),
        activeAssistantMessageId:
          event.message.role === "assistant" ? projected.id : state.activeAssistantMessageId,
      };
    }

    case "message.delta": {
      let nextState = withLastEvent(state, event.at);
      nextState = ensureAssistantMessage(nextState, event.message);
      const messageId = resolveActiveAssistantId(nextState, event.message);
      const messageIndex = nextState.messages.findIndex(
        (message) => message.id === messageId,
      );

      if (messageIndex === -1) {
        return nextState;
      }

      const currentMessage = nextState.messages[messageIndex];

      if (!currentMessage) {
        return nextState;
      }

      const nextMessages = nextState.messages.slice();
      let nextText = currentMessage.text;
      let nextThinking = currentMessage.thinking ?? "";
      let nextStatus = currentMessage.status;

      switch (event.assistantEvent.type) {
        case "text_delta":
          nextText = appendIfPresent(nextText, event.assistantEvent.delta);
          break;
        case "text_end":
          nextText = event.assistantEvent.content;
          break;
        case "thinking_delta":
          nextThinking = appendIfPresent(nextThinking, event.assistantEvent.delta);
          break;
        case "thinking_end":
          nextThinking = event.assistantEvent.content;
          break;
        case "done":
          nextStatus = "complete";
          break;
        case "error":
          nextStatus =
            event.assistantEvent.reason === "aborted" ? "aborted" : "error";
          break;
      }

      nextMessages[messageIndex] = {
        ...currentMessage,
        text: nextText,
        thinking: nextThinking || undefined,
        status: nextStatus,
      };

      return {
        ...nextState,
        messages: nextMessages,
      };
    }

    case "message.completed": {
      const projected = projectChatMessage(event.message);

      if (!projected) {
        return withLastEvent(state, event.at);
      }

      return {
        ...withLastEvent(state, event.at),
        messages: upsertMessage(state.messages, projected),
        activeAssistantMessageId:
          event.message.role === "assistant" ? undefined : state.activeAssistantMessageId,
      };
    }

    case "tool.started":
      return {
        ...withLastEvent(state, event.at),
        tools: upsertTool(state.tools, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          output: "",
          status: "running",
          updatedAt: event.at,
        }),
      };

    case "tool.updated": {
      const existingTool = state.tools.find(
        (tool) => tool.toolCallId === event.toolCallId,
      );

      return {
        ...withLastEvent(state, event.at),
        tools: upsertTool(state.tools, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: existingTool?.args,
          output: appendIfPresent(existingTool?.output ?? "", event.output),
          status: existingTool?.status ?? "running",
          updatedAt: event.at,
        }),
      };
    }

    case "tool.completed": {
      const existingTool = state.tools.find(
        (tool) => tool.toolCallId === event.toolCallId,
      );

      return {
        ...withLastEvent(state, event.at),
        tools: upsertTool(state.tools, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: existingTool?.args,
          output: appendIfPresent(existingTool?.output ?? "", event.output),
          status: event.isError ? "error" : "complete",
          updatedAt: event.at,
        }),
      };
    }
  }
}

export function buildPiUiEvents(
  sessionId: string,
  event: PiRpcEvent,
): PiUiEvent[] {
  const at = new Date().toISOString();

  switch (event.type) {
    case "agent_start":
      return [{ type: "agent.started", sessionId, at }];

    case "agent_end":
      return [{ type: "agent.ended", sessionId, at, messages: event.messages }];

    case "message_start":
      return [{ type: "message.started", sessionId, at, message: event.message }];

    case "message_update":
      return [
        {
          type: "message.delta",
          sessionId,
          at,
          message: event.message,
          assistantEvent: event.assistantMessageEvent,
        },
      ];

    case "message_end":
      return [{ type: "message.completed", sessionId, at, message: event.message }];

    case "tool_execution_start": {
      const identity = resolveToolIdentity(event);
      return [
        {
          type: "tool.started",
          sessionId,
          at,
          toolCallId: identity.toolCallId,
          toolName: identity.toolName,
          args: identity.args,
        },
      ];
    }

    case "tool_execution_update": {
      const identity = resolveToolIdentity(event);
      const output = stringifyToolPayload(event.partialResult);
      return [
        {
          type: "tool.updated",
          sessionId,
          at,
          toolCallId: identity.toolCallId,
          toolName: identity.toolName,
          output: output || undefined,
        },
      ];
    }

    case "tool_execution_end": {
      const identity = resolveToolIdentity(event);
      const output = stringifyToolPayload(event.result);
      return [
        {
          type: "tool.completed",
          sessionId,
          at,
          toolCallId: identity.toolCallId,
          toolName: identity.toolName,
          output: output || undefined,
          isError: Boolean(event.isError),
        },
      ];
    }

    default:
      return [];
  }
}

export function unwrapPiResponse<TData>(
  response: PiRpcResponse<TData>,
): TData | undefined {
  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}
