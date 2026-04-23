"use client";

import { useChat, type UseChatHelpers, type UseChatOptions } from "@ai-sdk/react";
import {
  type ChatInit,
  DefaultChatTransport,
  isReasoningUIPart,
  isTextUIPart,
  isToolOrDynamicToolUIPart,
  type DynamicToolUIPart,
  type HttpChatTransportInitOptions,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { useId, useMemo } from "react";

export type PiChatToolPart = DynamicToolUIPart | ToolUIPart;

export interface UsePiChatOptions<UI_MESSAGE extends UIMessage = UIMessage>
  extends Omit<ChatInit<UI_MESSAGE>, "id" | "transport">,
    HttpChatTransportInitOptions<UI_MESSAGE> {
  experimental_throttle?: UseChatOptions<UI_MESSAGE>["experimental_throttle"];
  id?: string;
  resume?: UseChatOptions<UI_MESSAGE>["resume"];
  transport?: DefaultChatTransport<UI_MESSAGE>;
}

export function createPiChatId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `pi-web-${Date.now()}`;
}

export function createPiChatTransport<UI_MESSAGE extends UIMessage = UIMessage>(
  options: HttpChatTransportInitOptions<UI_MESSAGE> = {},
): DefaultChatTransport<UI_MESSAGE> {
  return new DefaultChatTransport<UI_MESSAGE>({
    api: "/api/chat",
    ...options,
  });
}

export function usePiChat<UI_MESSAGE extends UIMessage = UIMessage>(
  options: UsePiChatOptions<UI_MESSAGE> = {},
): UseChatHelpers<UI_MESSAGE> {
  const {
    api = "/api/chat",
    body,
    credentials,
    experimental_throttle,
    fetch,
    headers,
    id,
    messageMetadataSchema,
    messages,
    onData,
    onError,
    onFinish,
    onToolCall,
    prepareReconnectToStreamRequest,
    prepareSendMessagesRequest,
    resume,
    sendAutomaticallyWhen,
    transport,
  } = options;
  const generatedId = useId().replaceAll(":", "");

  const resolvedTransport = useMemo(
    () =>
      transport ??
      createPiChatTransport<UI_MESSAGE>({
        api,
        body,
        credentials,
        fetch,
        headers,
        prepareReconnectToStreamRequest,
        prepareSendMessagesRequest,
      }),
    [
      api,
      body,
      credentials,
      fetch,
      headers,
      prepareReconnectToStreamRequest,
      prepareSendMessagesRequest,
      transport,
    ],
  );

  return useChat<UI_MESSAGE>({
    experimental_throttle,
    id: id ?? `pi-web-${generatedId}`,
    messageMetadataSchema,
    messages,
    onData,
    onError,
    onFinish,
    onToolCall,
    resume,
    sendAutomaticallyWhen,
    transport: resolvedTransport,
  });
}

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

export function getMessageReasoning(message: UIMessage): string {
  return message.parts
    .filter(isReasoningUIPart)
    .map((part) => part.text)
    .join("");
}

export function getMessageToolParts(message: UIMessage): PiChatToolPart[] {
  return message.parts.filter(isToolOrDynamicToolUIPart);
}

export type {
  DynamicToolUIPart,
  ToolUIPart,
  UIMessage,
};

export type PiChatTransport<UI_MESSAGE extends UIMessage = UIMessage> =
  DefaultChatTransport<UI_MESSAGE>;
