# Skills Guide

This repo ships two local Codex skills under `skills/`.

## `skills/pi-web-implement`

Use this when changing the monorepo itself:

- Pi RPC wrapper changes
- AI SDK UI transport changes
- Next.js route handler changes
- demo UI or theme changes
- docs and validation updates

It points the agent at the package boundaries, required validation commands, and the repo-specific constraints around Pi subprocesses and AI Elements.

## `skills/pi-web-use`

Use this when integrating `pi-web` into another app:

- setting up a `PiSessionRegistry`
- exposing `/api/chat` with `createPiChatHandler`
- using `usePiChat()` in React
- rendering messages, reasoning, and tool parts with AI Elements
- choosing a deployment model

These skills are meant to keep future work aligned with the verified architecture in this repo rather than re-deriving it from scratch each time.
