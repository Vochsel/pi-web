"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";
import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolOrDynamicToolUIPart,
  type UIMessage,
} from "ai";
import { PaperclipIcon } from "lucide-react";
import type { JSX } from "react";

export interface ChatMessageProps {
  message: UIMessage;
  streaming: boolean;
}

function AttachmentPill(props: {
  href?: string;
  label: string;
}): JSX.Element {
  const content = (
    <>
      <PaperclipIcon className="size-3" />
      <span className="truncate">{props.label}</span>
    </>
  );

  if (!props.href) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
        {content}
      </span>
    );
  }

  return (
    <a
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      href={props.href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
}

export function ChatMessage({
  message,
  streaming,
}: ChatMessageProps): JSX.Element {
  const attachments = message.parts.filter(isFileUIPart);

  return (
    <Message
      className={cn(
        message.role === "assistant" ? "max-w-full" : "max-w-[85%]",
      )}
      from={message.role}
    >
      <MessageContent
        className={cn(
          message.role === "assistant"
            ? "w-full max-w-none"
            : undefined,
        )}
      >
        {message.role === "user" ? (
          <div className="space-y-2">
            {message.parts.filter(isTextUIPart).map((part, index) => (
              <p className="whitespace-pre-wrap" key={`${message.id}-text-${index}`}>
                {part.text}
              </p>
            ))}

            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((part, index) => (
                  <AttachmentPill
                    href={part.url}
                    key={`${message.id}-file-${index}`}
                    label={part.filename ?? part.mediaType}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {message.parts.map((part, index) => {
              if (isReasoningUIPart(part) && part.text) {
                return (
                  <Reasoning
                    defaultOpen={part.state !== "done"}
                    isStreaming={streaming && part.state !== "done"}
                    key={`${message.id}-reasoning-${index}`}
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>{part.text}</ReasoningContent>
                  </Reasoning>
                );
              }

              if (isToolOrDynamicToolUIPart(part)) {
                const errorText = "errorText" in part ? part.errorText : undefined;
                const input = "input" in part ? part.input : undefined;
                const output = "output" in part ? part.output : undefined;
                const header =
                  part.type === "dynamic-tool" ? (
                    <ToolHeader
                      state={part.state}
                      title={part.title}
                      toolName={part.toolName}
                      type={part.type}
                    />
                  ) : (
                    <ToolHeader
                      state={part.state}
                      title={part.title}
                      type={part.type}
                    />
                  );

                return (
                  <Tool
                    defaultOpen={false}
                    key={`${message.id}-tool-${part.toolCallId}`}
                  >
                    {header}
                    <ToolContent>
                      {input !== undefined ? <ToolInput input={input} /> : null}
                      {output !== undefined || errorText ? (
                        <ToolOutput errorText={errorText} output={output} />
                      ) : null}
                    </ToolContent>
                  </Tool>
                );
              }

              if (isTextUIPart(part) && part.text) {
                return (
                  <MessageResponse
                    className="max-w-none text-sm leading-6 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
                    isAnimating={streaming && part.state !== "done"}
                    key={`${message.id}-response-${index}`}
                  >
                    {part.text}
                  </MessageResponse>
                );
              }

              if (isFileUIPart(part)) {
                return (
                  <div
                    className="flex flex-wrap gap-1.5"
                    key={`${message.id}-assistant-file-${index}`}
                  >
                    <AttachmentPill
                      href={part.url}
                      label={part.filename ?? part.mediaType}
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </MessageContent>
    </Message>
  );
}
