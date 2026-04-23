import { PiSessionRegistry } from "@pi-web/next";

declare global {
  // eslint-disable-next-line no-var
  var __piWebRegistry__: PiSessionRegistry | undefined;
}

function resolveWorkspaceRoot(): string {
  return process.env.PI_WORKSPACE_DIR ?? process.cwd();
}

function resolveToolProfile(): string[] {
  const configured = process.env.PI_TOOLS
    ?.split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return ["read", "grep", "find", "ls"];
}

export function getPiRegistry(): PiSessionRegistry {
  if (!globalThis.__piWebRegistry__) {
    globalThis.__piWebRegistry__ = new PiSessionRegistry({
      idleTtlMs: 10 * 60_000,
      cleanupIntervalMs: 60_000,
      maxSessions: 50,
      createClientOptions: () => ({
        cwd: resolveWorkspaceRoot(),
        sessionMode:
          process.env.PI_SESSION_MODE === "persistent"
            ? "persistent"
            : "ephemeral",
        sessionDir: process.env.PI_SESSION_DIR,
        tools: resolveToolProfile(),
      }),
    });
  }

  return globalThis.__piWebRegistry__;
}
