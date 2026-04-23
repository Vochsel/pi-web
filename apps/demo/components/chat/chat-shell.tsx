"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { usePiChat } from "@pi-web/react";
import { type FileUIPart } from "ai";
import {
  AlertTriangleIcon,
  FolderSearchIcon,
  SparklesIcon,
  SquareTerminalIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import type { JSX } from "react";

import { ChatMessage } from "./chat-message";

const starterPrompts = [
  {
    icon: FolderSearchIcon,
    label: "Inspect this repository and explain its architecture.",
  },
  {
    icon: SquareTerminalIcon,
    label: "Trace the Pi RPC integration path from the web UI to the subprocess.",
  },
  {
    icon: WrenchIcon,
    label: "Find the next production hardening gaps in this monorepo.",
  },
];

function ComposerAttachments(): JSX.Element | null {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {attachments.files.map((file) => (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
          key={file.id}
        >
          <span className="max-w-40 truncate">
            {file.filename ?? file.mediaType}
          </span>
          <button
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <XIcon className="size-3" />
            <span className="sr-only">Remove attachment</span>
          </button>
        </span>
      ))}
    </div>
  );
}

export function ChatShell(): JSX.Element {
  const { clearError, error, messages, sendMessage, status, stop } =
    usePiChat();

  async function handlePrompt(message: {
    files: FileUIPart[];
    text: string;
  }): Promise<void> {
    if (!message.text.trim() && message.files.length === 0) {
      return;
    }

    clearError();

    if (message.text.trim()) {
      await sendMessage({
        files: message.files,
        text: message.text.trim(),
      });
      return;
    }

    await sendMessage({
      files: message.files,
    });
  }

  async function handleStarterPrompt(prompt: string): Promise<void> {
    clearError();
    await sendMessage({
      text: prompt,
    });
  }

  const isBusy = status === "streaming" || status === "submitted";

  return (
    <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent
          className="flex flex-col gap-6 py-6"
          scrollClassName="scrollbar-hide"
        >
          {messages.length === 0 ? (
            <ConversationEmptyState className="flex-1 justify-center">
              <div className="flex max-w-xl flex-col items-center gap-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full border border-border">
                  <SparklesIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    What can Pi help you with?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Ask about this repository, trace the RPC flow, or explore the
                    workspace.
                  </p>
                </div>

                <div className="grid w-full gap-2 sm:grid-cols-1">
                  {starterPrompts.map(({ icon: Icon, label }) => (
                    <Button
                      className="h-auto justify-start gap-3 rounded-lg border-border bg-background px-4 py-3 text-left text-sm font-normal"
                      disabled={isBusy}
                      key={label}
                      onClick={() => {
                        void handleStarterPrompt(label);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  streaming={
                    status === "streaming" && index === messages.length - 1
                  }
                />
              ))}
            </>
          )}
        </ConversationContent>

        <ConversationScrollButton className="bottom-24" />
      </Conversation>

      {error ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{error.message}</p>
        </div>
      ) : null}

      <div className="pb-6">
        <div className="rounded-[1.75rem] border border-border bg-muted/40 p-1.5 shadow-sm">
          <PromptInputProvider>
            <PromptInput
              accept="image/*"
              className="[&_[data-slot=input-group]]:rounded-[1.35rem] [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-background"
              maxFiles={4}
              onSubmit={handlePrompt}
            >
              <PromptInputHeader>
                <ComposerAttachments />
              </PromptInputHeader>

              <PromptInputBody>
                <PromptInputTextarea placeholder="Message Pi..." />
              </PromptInputBody>

              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger tooltip="Attach" />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                      <PromptInputActionAddScreenshot />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                </PromptInputTools>

                <PromptInputSubmit
                  onStop={() => {
                    void stop();
                  }}
                  status={status}
                />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
        </div>
      </div>
    </div>
  );
}
