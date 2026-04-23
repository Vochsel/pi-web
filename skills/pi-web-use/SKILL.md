---
name: pi-web-use
description: Use when integrating pi-web into another React or Next.js app. Covers the default session strategy, the `/api/chat` server route, `usePiChat()`, AI Elements rendering, and the deployment caveats for long-lived Pi RPC subprocesses.
---

# pi-web-use

Use this skill when consuming the packages from another app.

## Default integration path

1. Create a long-lived `PiSessionRegistry` in a Node runtime.
2. Expose `POST /api/chat` with `createPiChatHandler({ registry })`.
3. Use `usePiChat()` from `@pi-web/react` in the browser.
4. Render `message.parts` with AI Elements-style `conversation`, `message`, `reasoning`, `tool`, and `prompt-input` components.

## Assumptions

- Pi runs via `pi --mode rpc`.
- The browser never talks directly to the Pi subprocess.
- AI SDK UI SSE is the default transport.
- One Pi process per chat/session id is the intended MVP model.

## Runtime checklist

- mark the Next route as `runtime = "nodejs"`
- keep Pi tool profiles narrow at first
- decide whether sessions are `ephemeral` or `persistent`
- set `PI_WORKSPACE_DIR` for the project Pi should inspect

## Deployment guidance

- Prefer long-lived Node hosting over serverless or Edge.
- If you need a serverless frontend, split the Pi layer into a separate Node service.
- Add auth, ownership checks, and workspace isolation before enabling broader tool access.

## Validation

After wiring a new app, verify:

```bash
bun run typecheck
bun run build
bun run smoke:rpc
```

Then test one end-to-end chat that exercises at least one visible tool event.
