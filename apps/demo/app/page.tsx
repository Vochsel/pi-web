import type { ReactNode } from "react";

import { ChatShell } from "@/components/chat/chat-shell";

export default function HomePage(): ReactNode {
  return (
    <main className="flex h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background text-xs font-semibold">
              π
            </div>
            <span className="text-sm font-medium">pi-web</span>
            <span className="text-sm text-muted-foreground">demo</span>
          </div>
          <a
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            href="https://github.com"
            rel="noreferrer"
            target="_blank"
          >
            Pi CLI agent over RPC
          </a>
        </div>
      </header>

      <ChatShell />
    </main>
  );
}
