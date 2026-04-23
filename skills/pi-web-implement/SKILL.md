---
name: pi-web-implement
description: Use when changing this repository's Pi RPC transport, Bun workspace packages, AI SDK chat bridge, or the demo app. Covers the package boundaries, validation commands, and repo-specific constraints around AI Elements, `/api/chat`, and server-side Pi subprocesses.
---

# pi-web-implement

Use this skill for changes inside this repo.

## Repo map

- `packages/client`: Pi RPC process wrapper, JSONL parsing, session registry
- `packages/next`: Next.js route helpers, especially `createPiChatHandler`
- `packages/react`: `usePiChat()` and AI SDK client helpers
- `apps/demo`: AI Elements-based reference app
- `docs/`: architecture, package, deployment, and skills docs

## Working rules

1. Keep Pi server-side. The browser should only talk to `/api/chat` or the low-level HTTP routes.
2. Preserve LF-only JSONL parsing in `packages/client/src/jsonl.ts`.
3. When changing streamed chat behavior, keep the `@pi-web/next` mapping aligned with AI SDK UI chunk semantics.
4. Prefer the generated Elements components in `apps/demo/components/ai-elements/` over custom replacements unless the change cannot be expressed there.
5. If you change package APIs or runtime assumptions, update `README.md` and the markdown docs in `docs/`.

## Validation

Run these from the repo root:

```bash
bun run typecheck
bun run build
bun run test
bun run smoke:rpc
```

## Common pitfalls

- The demo consumes built workspace output, so package changes must still build cleanly.
- `/api/chat` and the Pi routes must stay on the Node runtime.
- The demo theme depends on shadcn-style CSS tokens in `apps/demo/app/globals.css`.
- Tool activity is rendered as AI SDK dynamic tool parts; avoid drifting into a parallel UI protocol.
