import {
  PiSessionRegistry,
  type PiSession,
} from "@pi-web/client/node";
import type {
  PiAbortRequest,
  PiCommandAck,
  PiPromptRequest,
  PiTransportEvent,
} from "@pi-web/client/shared";
import {
  createPiChatHandler,
  type PiChatHandlerOptions,
} from "./chat.js";

export { PiSessionRegistry } from "@pi-web/client/node";
export type {
  PiAbortRequest,
  PiCommandAck,
  PiPromptRequest,
  PiTransportEvent,
} from "@pi-web/client/shared";
export {
  createPiChatHandler,
};
export type {
  PiChatHandlerOptions,
};

export interface PiSseHandlerOptions {
  registry: PiSessionRegistry;
  heartbeatMs?: number;
  warmOnConnect?: boolean;
}

export interface PiCommandHandlerOptions {
  registry: PiSessionRegistry;
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

function notFound(message: string): Response {
  return json({ error: message }, 404);
}

function readSessionIdFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("sessionId");
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPromptRequest(value: unknown): value is PiPromptRequest {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    typeof value.message === "string" &&
    (value.command === undefined ||
      value.command === "prompt" ||
      value.command === "steer" ||
      value.command === "follow_up")
  );
}

function isAbortRequest(value: unknown): value is PiAbortRequest {
  return isRecord(value) && typeof value.sessionId === "string";
}

function formatSseEvent(event: PiTransportEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function getExistingSession(
  registry: PiSessionRegistry,
  sessionId: string,
): PiSession | null {
  if (!registry.has(sessionId)) {
    return null;
  }

  return registry.getOrCreate(sessionId);
}

export function createPiSseHandler(options: PiSseHandlerOptions) {
  const { registry, heartbeatMs = 15_000, warmOnConnect = false } = options;

  return async function handlePiSse(request: Request): Promise<Response> {
    const sessionId = readSessionIdFromUrl(request);

    if (!sessionId) {
      return badRequest("Missing sessionId query parameter");
    }

    const session = registry.getOrCreate(sessionId);

    if (warmOnConnect) {
      void session.ensureStarted().catch(() => {
        // The SSE subscriber will receive the resulting session.error event.
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let isClosed = false;

        const close = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        };

        const unsubscribe = session.subscribe((event) => {
          controller.enqueue(encoder.encode(formatSseEvent(event)));
        });

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        }, heartbeatMs);

        request.signal.addEventListener("abort", close);
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  };
}

export function createPiMessageHandler(options: PiCommandHandlerOptions) {
  const { registry } = options;

  return async function handlePiMessage(request: Request): Promise<Response> {
    try {
      const payload = await readJsonBody(request);

      if (!isPromptRequest(payload)) {
        return badRequest("Expected { sessionId, message, command? }");
      }

      const session = registry.getOrCreate(payload.sessionId);
      let ack: PiCommandAck;

      switch (payload.command) {
        case "steer":
          ack = await session.steer(payload.message, payload.images);
          break;
        case "follow_up":
          ack = await session.followUp(payload.message, payload.images);
          break;
        case "prompt":
        case undefined:
          ack = await session.prompt(payload.message, {
            images: payload.images,
            streamingBehavior: payload.streamingBehavior,
          });
          break;
        default:
          return badRequest(`Unsupported command: ${String(payload.command)}`);
      }

      return json(ack);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Failed to send Pi command";
      return json({ error: detail }, 500);
    }
  };
}

export function createPiAbortHandler(options: PiCommandHandlerOptions) {
  const { registry } = options;

  return async function handlePiAbort(request: Request): Promise<Response> {
    try {
      const payload = await readJsonBody(request);

      if (!isAbortRequest(payload)) {
        return badRequest("Expected { sessionId }");
      }

      const session = getExistingSession(registry, payload.sessionId);

      if (!session) {
        return notFound(`No active session for "${payload.sessionId}"`);
      }

      const ack = await session.abort();
      return json(ack);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Failed to abort Pi request";
      return json({ error: detail }, 500);
    }
  };
}

export function createPiStateHandler(options: PiCommandHandlerOptions) {
  const { registry } = options;

  return async function handlePiState(request: Request): Promise<Response> {
    try {
      const sessionId = readSessionIdFromUrl(request);

      if (!sessionId) {
        return badRequest("Missing sessionId query parameter");
      }

      const session = getExistingSession(registry, sessionId);

      if (!session) {
        return notFound(`No active session for "${sessionId}"`);
      }

      return json(session.snapshot);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Failed to read Pi state";
      return json({ error: detail }, 500);
    }
  };
}
