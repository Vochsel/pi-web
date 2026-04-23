# Package Guide

## `@pi-web/client`

This is the core runtime package.

Use `@pi-web/client/node` for server-side Pi integration:

```ts
import { PiRpcClient, PiSessionRegistry } from "@pi-web/client/node";

const registry = new PiSessionRegistry({
  createClientOptions: () => ({
    sessionMode: "ephemeral",
    tools: ["read", "grep", "find", "ls"],
  }),
});
```

Important exports:

- `PiRpcClient`
- `PiSession`
- `PiSessionRegistry`

Use `@pi-web/client/shared` for browser-safe types and helpers:

```ts
import {
  flattenPiMessageText,
  reducePiTransportEvent,
  type PiTransportEvent,
} from "@pi-web/client/shared";
```

That entrypoint contains protocol types, normalized transport events, and reducer helpers.

## `@pi-web/next`

This package removes most of the App Router boilerplate.

Primary export:

```ts
import { createPiChatHandler } from "@pi-web/next";
```

Typical usage:

```ts
import { createPiChatHandler } from "@pi-web/next";
import { getPiRegistry } from "@/lib/pi-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createPiChatHandler({
  registry: getPiRegistry(),
});

export async function POST(request: Request) {
  return await handler(request);
}
```

Low-level helpers are still available:

- `createPiSseHandler`
- `createPiMessageHandler`
- `createPiAbortHandler`
- `createPiStateHandler`

Those are useful if you want direct transport access instead of AI SDK UI chat semantics.

## `@pi-web/react`

This package wraps AI SDK `useChat()` for Pi-specific defaults.

```ts
import { usePiChat } from "@pi-web/react";

const { messages, sendMessage, status, stop, error } = usePiChat();
```

Useful exports:

- `usePiChat`
- `createPiChatTransport`
- `createPiChatId`
- `getMessageText`
- `getMessageReasoning`
- `getMessageToolParts`

It is intentionally thin: transport and rendering stay aligned with AI SDK primitives rather than inventing a separate client protocol.

## `@pi-web/demo`

The demo is the reference integration for this repo.

Important files:

- `app/api/chat/route.ts`: AI SDK chat endpoint backed by Pi RPC
- `lib/pi-server.ts`: session registry singleton and env-based Pi config
- `components/ai-elements/`: generated Elements/chat UI primitives
- `components/chat/`: demo-specific composition around the generated primitives
- `app/page.tsx`: landing shell

The demo also preserves `/api/pi/*` routes for lower-level debugging.
