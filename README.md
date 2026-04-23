# pi-web

`pi-web` is a Bun monorepo for exposing the Pi mono CLI agent to the web through `pi --mode rpc`.

The repo keeps Pi server-side, adapts its newline-delimited JSON RPC stream into AI SDK UI message chunks, and renders the result with AI SDK Elements-style chat components in a Next.js demo.

## Workspaces

- `@pi-web/client`: shared Pi protocol types plus the Node-side RPC process wrapper and session registry.
- `@pi-web/react`: a React client built on `useChat` and the AI SDK default chat transport.
- `@pi-web/next`: Next.js App Router helpers, including `createPiChatHandler` for `/api/chat`.
- `@pi-web/demo`: a Next.js App Router demo that uses AI Elements components for messages, reasoning, tools, and prompt input.

## Prerequisites

- Bun
- `pi` installed and available on `PATH`

## Quick start

```bash
bun install
bun run typecheck
bun run build
bun run smoke:rpc
bun run dev
```

The demo app runs on `http://localhost:3000`.

## Demo environment

The demo registry reads a few optional environment variables:

- `PI_WORKSPACE_DIR`: working directory Pi should inspect. Defaults to the repo root.
- `PI_TOOLS`: comma-separated tool allowlist. Defaults to `read,grep,find,ls`.
- `PI_SESSION_MODE`: `ephemeral` or `persistent`. Defaults to `ephemeral`.
- `PI_SESSION_DIR`: session directory used when `PI_SESSION_MODE=persistent`.

## Default architecture

- Browser UI: `usePiChat()` from `@pi-web/react` plus AI Elements chat primitives.
- Next.js route: `POST /api/chat` via `createPiChatHandler()`.
- Session layer: `PiSessionRegistry` keeps one Pi subprocess per chat/session id.
- Process layer: `PiRpcClient` spawns `pi --mode rpc` and parses LF-delimited JSONL from stdout.
- Transport: AI SDK UI chunks streamed as SSE to the browser.

The demo also keeps the lower-level `/api/pi/*` routes for direct transport debugging.

## Repo layout

```text
apps/
  demo/        Next.js + AI Elements reference app
docs/          architecture, package, deployment, and skill docs
packages/
  client/      Pi RPC wrapper and session manager
  react/       AI SDK React hook wrapper
  next/        Next.js route helpers
skills/        repo-local Codex skills for implementing or consuming pi-web
```

## Commands

```bash
bun run build
bun run typecheck
bun run test
bun run smoke:rpc
```

## Documentation

- [Architecture Guide](docs/architecture.md)
- [Package Guide](docs/packages.md)
- [Deployment Notes](docs/deployment.md)
- [Skills Guide](docs/skills.md)
