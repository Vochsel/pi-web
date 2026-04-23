# Deployment Notes

## Recommended runtime

Run this stack on a long-lived Node host:

- Docker on a VM
- Fly.io Machines
- Railway
- Render
- Kubernetes
- your own Node service

Do not treat Edge or classic serverless functions as the primary target.

## Why serverless is awkward here

- Pi runs as a subprocess.
- Chat streams stay open for a while.
- Session state is kept in memory unless you externalize it.
- Abort and cleanup semantics are much cleaner with durable processes.

If you want a serverless frontend, keep the Next.js UI there and move the Pi layer into a separate Node service.

## Demo environment variables

- `PI_WORKSPACE_DIR`: working directory Pi should inspect
- `PI_TOOLS`: comma-separated tool allowlist
- `PI_SESSION_MODE`: `ephemeral` or `persistent`
- `PI_SESSION_DIR`: persistent session directory when enabled

## Safety baseline

The demo defaults to a read-oriented tool profile:

```text
read,grep,find,ls
```

Before you widen that profile:

- authenticate every route
- authorize session ownership
- isolate workspaces per user or task
- cap session count and idle lifetime
- log prompts, stderr, exits, and tool activity
- enforce prompt and attachment size limits

## Workspace strategy

Practical development setup:

- point `PI_WORKSPACE_DIR` at the repo or project you want Pi to inspect
- keep tools read-only first
- use ephemeral sessions unless you are explicitly testing persistence

Safer production setup:

- allocate per-user or per-task workspaces
- run Pi inside a container or VM
- avoid sharing writable directories between users
- persist metadata outside process memory if you run multiple app instances

## Observability

Useful metrics:

- active session count
- prompt latency
- time to first streamed chunk
- time to `agent.ended`
- process exits
- stderr volume

Useful logs:

- user id
- session id
- workspace id
- prompt size
- command type
- exit code or signal
- last stderr excerpt on failure

## Build note

The Next.js production build currently succeeds but still emits one non-fatal Turbopack NFT tracing warning tied to the server-side `child_process` path. Treat it as an operational note, not a failing build condition.
