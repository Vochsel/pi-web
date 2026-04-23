import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";

import { PiSessionRegistry } from "@pi-web/client/node";
import {
  extractPiThinking,
  flattenPiMessageText,
  type PiAssistantMessage,
  type PiImageContent,
  type PiToolCallContent,
  type PiTransportEvent,
} from "@pi-web/client/shared";

type ChatTrigger = "submit-message" | "regenerate-message";

interface PiChatRequestBody<UI_MESSAGE extends UIMessage = UIMessage> {
  id?: string;
  messages?: UI_MESSAGE[];
  trigger?: ChatTrigger;
  messageId?: string;
  sessionId?: string;
}

export interface PiChatHandlerOptions {
  registry: PiSessionRegistry;
}

interface PiToolStreamState {
  inputEmitted: boolean;
  started: boolean;
  toolCallId: string;
  toolName: string;
}

interface PiUiStreamState {
  aborted: boolean;
  finished: boolean;
  messageStarted: boolean;
  reasoningPartId: string;
  reasoningStarted: boolean;
  textPartId: string;
  textStarted: boolean;
  tools: Map<string, PiToolStreamState>;
}

type PiWriter = UIMessageStreamWriter<UIMessage>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUiMessage(value: unknown): value is UIMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.role === "string" &&
    Array.isArray(value.parts)
  );
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function conflict(message: string): Response {
  return json({ error: message }, 409);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Pi chat error";
}

function createId(prefix: string): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function createUiStreamState(): PiUiStreamState {
  return {
    aborted: false,
    finished: false,
    messageStarted: false,
    reasoningPartId: createId("pi-reasoning"),
    reasoningStarted: false,
    textPartId: createId("pi-text"),
    textStarted: false,
    tools: new Map<string, PiToolStreamState>(),
  };
}

function readTextFromUiMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (
        part,
      ): part is Extract<UIMessage["parts"][number], { type: "text"; text: string }> =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

function parseDataUrl(
  url: string,
): {
  data: string;
  mimeType: string;
} | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(url);

  if (!match) {
    return null;
  }

  const [, mimeType, data] = match;

  if (!mimeType || !data) {
    return null;
  }

  return {
    data,
    mimeType,
  };
}

function readImagesFromUiMessage(message: UIMessage): PiImageContent[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "file" || typeof part.url !== "string") {
      return [];
    }

    if (typeof part.mediaType !== "string" || !part.mediaType.startsWith("image/")) {
      return [];
    }

    const parsed = parseDataUrl(part.url);

    if (!parsed) {
      return [];
    }

    return [
      {
        type: "image",
        data: parsed.data,
        mimeType: parsed.mimeType,
      },
    ];
  });
}

async function readChatBody(
  request: Request,
): Promise<PiChatRequestBody | null> {
  try {
    const payload = (await request.json()) as unknown;

    if (!isRecord(payload)) {
      return null;
    }

    const { id, messages, trigger, messageId, sessionId } = payload;

    if (id !== undefined && typeof id !== "string") {
      return null;
    }

    if (sessionId !== undefined && typeof sessionId !== "string") {
      return null;
    }

    if (
      trigger !== undefined &&
      trigger !== "submit-message" &&
      trigger !== "regenerate-message"
    ) {
      return null;
    }

    if (messageId !== undefined && typeof messageId !== "string") {
      return null;
    }

    if (
      messages !== undefined &&
      (!Array.isArray(messages) || !messages.every(isUiMessage))
    ) {
      return null;
    }

    return {
      id,
      messageId,
      messages,
      sessionId,
      trigger,
    };
  } catch {
    return null;
  }
}

function getLatestUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];

    if (candidate?.role === "user") {
      return candidate;
    }
  }

  return null;
}

function stringifyToolValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveToolCall(
  value: Partial<Pick<PiToolCallContent, "arguments" | "id" | "name">> & {
    args?: unknown;
    toolCallId?: string;
    toolName?: string;
  },
): {
  args?: unknown;
  toolCallId: string;
  toolName: string;
} {
  return {
    args: value.arguments ?? value.args,
    toolCallId: value.id ?? value.toolCallId ?? "pi-tool-call",
    toolName: value.name ?? value.toolName ?? "pi-tool",
  };
}

function ensureAssistantMessageStart(
  writer: PiWriter,
  state: PiUiStreamState,
): void {
  if (state.messageStarted) {
    return;
  }

  writer.write({
    type: "start",
  });
  state.messageStarted = true;
}

function ensureTextPartStart(
  writer: PiWriter,
  state: PiUiStreamState,
): void {
  ensureAssistantMessageStart(writer, state);

  if (state.textStarted) {
    return;
  }

  writer.write({
    type: "text-start",
    id: state.textPartId,
  });
  state.textStarted = true;
}

function ensureReasoningPartStart(
  writer: PiWriter,
  state: PiUiStreamState,
): void {
  ensureAssistantMessageStart(writer, state);

  if (state.reasoningStarted) {
    return;
  }

  writer.write({
    type: "reasoning-start",
    id: state.reasoningPartId,
  });
  state.reasoningStarted = true;
}

function endOpenParts(
  writer: PiWriter,
  state: PiUiStreamState,
): void {
  if (state.reasoningStarted) {
    writer.write({
      type: "reasoning-end",
      id: state.reasoningPartId,
    });
    state.reasoningStarted = false;
  }

  if (state.textStarted) {
    writer.write({
      type: "text-end",
      id: state.textPartId,
    });
    state.textStarted = false;
  }
}

function ensureToolState(
  toolCallId: string,
  toolName: string,
  state: PiUiStreamState,
): PiToolStreamState {
  const existing = state.tools.get(toolCallId);

  if (existing) {
    if (toolName !== existing.toolName) {
      existing.toolName = toolName;
    }

    return existing;
  }

  const created: PiToolStreamState = {
    inputEmitted: false,
    started: false,
    toolCallId,
    toolName,
  };
  state.tools.set(toolCallId, created);
  return created;
}

function emitToolStart(
  writer: PiWriter,
  toolCallId: string,
  toolName: string,
  state: PiUiStreamState,
): PiToolStreamState {
  ensureAssistantMessageStart(writer, state);

  const toolState = ensureToolState(toolCallId, toolName, state);

  if (toolState.started) {
    return toolState;
  }

  writer.write({
    type: "tool-input-start",
    dynamic: true,
    toolCallId,
    toolName,
  });
  toolState.started = true;
  return toolState;
}

function emitToolInput(
  writer: PiWriter,
  toolCallId: string,
  toolName: string,
  input: unknown,
  state: PiUiStreamState,
): void {
  const toolState = emitToolStart(writer, toolCallId, toolName, state);

  if (toolState.inputEmitted) {
    return;
  }

  writer.write({
    type: "tool-input-available",
    dynamic: true,
    input,
    toolCallId,
    toolName,
  });
  toolState.inputEmitted = true;
}

function emitToolOutput(
  writer: PiWriter,
  toolCallId: string,
  toolName: string,
  state: PiUiStreamState,
  output: unknown,
  isError: boolean,
): void {
  emitToolStart(writer, toolCallId, toolName, state);

  if (isError) {
    writer.write({
      type: "tool-output-error",
      dynamic: true,
      errorText: stringifyToolValue(output) || "Pi tool execution failed",
      toolCallId,
    });
    return;
  }

  writer.write({
    type: "tool-output-available",
    dynamic: true,
    output,
    toolCallId,
  });
}

function syncAssistantMessage(
  writer: PiWriter,
  state: PiUiStreamState,
  message: PiAssistantMessage,
): void {
  const reasoning = extractPiThinking(message.content);

  if (reasoning) {
    ensureReasoningPartStart(writer, state);
    if (state.reasoningStarted) {
      writer.write({
        type: "reasoning-delta",
        delta: reasoning,
        id: state.reasoningPartId,
      });
    }
  }

  const text = flattenPiMessageText(message);

  if (text) {
    ensureTextPartStart(writer, state);
    if (state.textStarted) {
      writer.write({
        type: "text-delta",
        delta: text,
        id: state.textPartId,
      });
    }
  }

  endOpenParts(writer, state);
}

function handlePiEvent(
  event: PiTransportEvent,
  writer: PiWriter,
  state: PiUiStreamState,
): FinishReason | null {
  if (event.type === "snapshot") {
    return null;
  }

  switch (event.type) {
    case "agent.started":
      ensureAssistantMessageStart(writer, state);
      return null;

    case "message.started":
      if (event.message.role === "assistant") {
        ensureAssistantMessageStart(writer, state);
      }
      return null;

    case "message.delta":
      ensureAssistantMessageStart(writer, state);

      switch (event.assistantEvent.type) {
        case "text_start":
          ensureTextPartStart(writer, state);
          return null;

        case "text_delta":
          ensureTextPartStart(writer, state);
          writer.write({
            type: "text-delta",
            delta: event.assistantEvent.delta,
            id: state.textPartId,
          });
          return null;

        case "text_end":
          ensureTextPartStart(writer, state);
          writer.write({
            type: "text-end",
            id: state.textPartId,
          });
          state.textStarted = false;
          return null;

        case "thinking_start":
          ensureReasoningPartStart(writer, state);
          return null;

        case "thinking_delta":
          ensureReasoningPartStart(writer, state);
          writer.write({
            type: "reasoning-delta",
            delta: event.assistantEvent.delta,
            id: state.reasoningPartId,
          });
          return null;

        case "thinking_end":
          ensureReasoningPartStart(writer, state);
          writer.write({
            type: "reasoning-end",
            id: state.reasoningPartId,
          });
          state.reasoningStarted = false;
          return null;

        case "toolcall_end":
          if (!event.assistantEvent.toolCall) {
            return null;
          }

          {
            const tool = resolveToolCall(event.assistantEvent.toolCall);
            emitToolInput(
              writer,
              tool.toolCallId,
              tool.toolName,
              tool.args ?? {},
              state,
            );
          }
          return null;

        case "error":
          if (event.assistantEvent.reason === "aborted") {
            state.aborted = true;
            writer.write({
              type: "abort",
              reason: "Pi RPC request aborted",
            });
            return "other";
          }

          writer.write({
            type: "error",
            errorText:
              event.assistantEvent.reason ?? "Pi RPC response stream failed",
          });
          return "error";

        default:
          return null;
      }

    case "message.completed":
      if (event.message.role !== "assistant") {
        return null;
      }

      syncAssistantMessage(writer, state, event.message);

      if (event.message.stopReason === "aborted") {
        state.aborted = true;
        writer.write({
          type: "abort",
          reason: "Pi RPC request aborted",
        });
        return "other";
      }

      if (event.message.stopReason === "error") {
        return "error";
      }

      return null;

    case "tool.started": {
      const tool = resolveToolCall({
        args: event.args,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });

      if (tool.args !== undefined) {
        emitToolInput(writer, tool.toolCallId, tool.toolName, tool.args, state);
      } else {
        emitToolStart(writer, tool.toolCallId, tool.toolName, state);
      }
      return null;
    }

    case "tool.completed": {
      const tool = resolveToolCall({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });

      emitToolOutput(
        writer,
        tool.toolCallId,
        tool.toolName,
        state,
        event.output ?? {},
        event.isError,
      );
      return null;
    }

    case "session.error":
      writer.write({
        type: "error",
        errorText: event.message,
      });
      return "error";

    case "agent.ended":
      return state.aborted ? "other" : "stop";

    default:
      return null;
  }
}

async function streamPiResponse(options: {
  images: PiImageContent[];
  prompt: string;
  requestSignal: AbortSignal;
  sessionId: string;
  writer: PiWriter;
} & PiChatHandlerOptions): Promise<void> {
  const { images, prompt, registry, requestSignal, sessionId, writer } = options;
  const session = registry.getOrCreate(sessionId);
  const state = createUiStreamState();

  if (session.snapshot.status === "streaming") {
    writer.write({
      type: "error",
      errorText: `Pi session "${sessionId}" is already streaming a response.`,
    });
    writer.write({
      type: "finish",
      finishReason: "error",
    });
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const cleanup = (): void => {
      unsubscribe();
      requestSignal.removeEventListener("abort", handleAbort);
    };

    const finish = (finishReason: FinishReason): void => {
      if (settled) {
        return;
      }

      settled = true;
      endOpenParts(writer, state);
      writer.write({
        type: "finish",
        finishReason,
      });
      state.finished = true;
      cleanup();
      resolve();
    };

    const fail = (message: string): void => {
      if (settled) {
        return;
      }

      ensureAssistantMessageStart(writer, state);
      writer.write({
        type: "error",
        errorText: message,
      });
      finish("error");
    };

    const handleAbort = (): void => {
      if (settled) {
        return;
      }

      state.aborted = true;
      void session.abort().catch(() => {
        // The stream is already terminating. Surface the original abort instead.
      });

      ensureAssistantMessageStart(writer, state);
      writer.write({
        type: "abort",
        reason: "Client connection closed",
      });
      finish("other");
    };

    const unsubscribe = session.subscribe(
      (event) => {
        try {
          const finishReason = handlePiEvent(event, writer, state);

          if (finishReason) {
            finish(finishReason);
          }
        } catch (error) {
          fail(getErrorMessage(error));
        }
      },
      { replaySnapshot: false },
    );

    requestSignal.addEventListener("abort", handleAbort, { once: true });

    void session
      .prompt(prompt, images.length > 0 ? { images } : {})
      .catch((error) => {
        fail(getErrorMessage(error));
      });
  });
}

export function createPiChatHandler(options: PiChatHandlerOptions) {
  const { registry } = options;

  return async function handlePiChat(request: Request): Promise<Response> {
    const payload = await readChatBody(request);

    if (!payload || !payload.messages || payload.messages.length === 0) {
      return badRequest("Expected an AI SDK chat payload with { id, messages }.");
    }

    if (payload.trigger === "regenerate-message") {
      return conflict(
        "Pi RPC sessions do not support in-place regeneration. Submit a new user message instead.",
      );
    }

    const latestUserMessage = getLatestUserMessage(payload.messages);

    if (!latestUserMessage) {
      return badRequest("No user message was found in the chat payload.");
    }

    const sessionId = payload.sessionId ?? payload.id;

    if (!sessionId) {
      return badRequest("Missing chat id for Pi session routing.");
    }

    const images = readImagesFromUiMessage(latestUserMessage);
    const messageText = readTextFromUiMessage(latestUserMessage);
    const prompt =
      messageText || (images.length > 0 ? "Please inspect the attached image input." : "");

    if (!prompt) {
      return badRequest("The latest user message did not include any text content.");
    }

    const stream = createUIMessageStream<UIMessage>({
      originalMessages: payload.messages,
      execute: async ({ writer }) => {
        await streamPiResponse({
          images,
          prompt,
          registry,
          requestSignal: request.signal,
          sessionId,
          writer,
        });
      },
      onError: getErrorMessage,
    });

    return createUIMessageStreamResponse({
      stream,
    });
  };
}
