# Architecture Guide

## Recommendation

Use one long-lived Pi RPC subprocess per chat/session id, run it in a Node runtime, and expose it to the browser through an AI SDK UI `/api/chat` route.

That is the default shape implemented in this repo:

- Browser: `usePiChat()` from `@pi-web/react`
- UI: AI Elements-style `conversation`, `message`, `reasoning`, `tool`, and `prompt-input` components in `apps/demo/components/ai-elements/`
- Next.js server: `createPiChatHandler()` from `@pi-web/next`
- Session/process layer: `PiSessionRegistry` and `PiRpcClient` from `@pi-web/client/node`

## End-to-end flow

1. The React client calls `usePiChat()` and uses the AI SDK default chat transport against `POST /api/chat`.
2. The Next.js route handler validates the chat payload and picks a session id from the chat id.
3. `PiSessionRegistry` returns the matching `PiSession`, creating a Pi subprocess if needed.
4. `PiRpcClient` spawns `pi --mode rpc` and sends JSON commands over stdin.
5. Pi emits newline-delimited JSON messages on stdout.
6. `@pi-web/client` parses stdout strictly as LF-delimited JSONL.
7. `@pi-web/next` maps Pi session events into AI SDK UI message chunks.
8. The route streams those chunks back to the browser as SSE.
9. AI SDK `useChat()` updates the local message state and the Elements components render text, reasoning, and tool parts incrementally.

## Why Pi stays server-side

- Pi RPC is a stdio subprocess protocol and requires `child_process.spawn`.
- Filesystem/tool access belongs in a controlled server environment, not the browser.
- API keys, provider configuration, workspace mounts, and tool allowlists must stay server-side.
- Session cleanup, idle expiry, and crash handling depend on durable Node processes.

## Streaming choice

Default to SSE through AI SDK UI streams.

Why:

- Pi already emits server-to-client event streams naturally.
- The browser only needs plain outbound requests such as submit-message and abort.
- `DefaultChatTransport` already expects a UI-message SSE stream.
- AI Elements components work directly from `useChat()` state.

Use WebSockets only if you need low-latency bidirectional control beyond normal chat submits and aborts.

## Backend contract

The main server helper is `createPiChatHandler()` in `packages/next/src/chat.ts`.

It currently does four important jobs:

1. Reads the AI SDK chat payload and finds the latest user message.
2. Extracts text and inline image data from that message.
3. Forwards the prompt into the matching `PiSession`.
4. Converts Pi transport events into AI SDK UI chunks such as:
   - `start`
   - `text-start` / `text-delta` / `text-end`
   - `reasoning-start` / `reasoning-delta` / `reasoning-end`
   - `tool-input-start`
   - `tool-input-available`
   - `tool-output-available`
   - `tool-output-error`
   - `abort`
   - `finish`

Tool calls are emitted as dynamic tool parts so the UI can render arbitrary Pi tool names without a static tool registry.

## Session model

The demo uses:

- one Pi process per chat/session id
- in-memory registry storage
- idle cleanup after 10 minutes
- a default read-oriented tool profile

This is the right default for an MVP because it gives straightforward isolation and a clean abort boundary.

More scalable options later:

- persistent session metadata in Redis/Postgres
- explicit auth and chat ownership
- per-user workspaces
- containerized Pi workers
- queueing and concurrency controls

## Current package boundaries

- `packages/client/src/jsonl.ts`: LF-only JSONL framing
- `packages/client/src/node.ts`: process wrapper, session abstraction, registry
- `packages/client/src/shared.ts`: protocol types and normalized transport events
- `packages/next/src/chat.ts`: AI SDK UI stream bridge
- `packages/react/src/index.ts`: `usePiChat()` and light message helpers
- `apps/demo/app/api/chat/route.ts`: Node-only App Router endpoint
- `apps/demo/components/chat/`: demo-specific wiring around generated AI Elements components

## Demo notes

The demo keeps the older `/api/pi/*` routes for raw transport inspection, but the main UI path is `/api/chat`.

The production build currently succeeds. Turbopack still emits one non-fatal NFT tracing warning around the server-side `child_process` path in `apps/demo/lib/pi-server.ts`; it does not block the build, but it is worth tracking if you tighten production build policies.
