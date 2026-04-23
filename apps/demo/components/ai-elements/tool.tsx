"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      "group not-prose w-full overflow-hidden rounded-lg border border-border bg-muted/30",
      className,
    )}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "awaiting approval",
  "approval-responded": "responded",
  "input-available": "running",
  "input-streaming": "pending",
  "output-available": "done",
  "output-denied": "denied",
  "output-error": "error",
};

function StatusIndicator({ state }: { state: ToolPart["state"] }): ReactNode {
  if (state === "output-available") {
    return <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-500" />;
  }
  if (state === "output-error" || state === "output-denied") {
    return <XIcon className="size-3 text-destructive" />;
  }
  if (state === "input-available" || state === "input-streaming") {
    return <Loader2Icon className="size-3 animate-spin text-muted-foreground" />;
  }
  return <span className="size-1.5 rounded-full bg-muted-foreground" />;
}

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs font-medium text-foreground">
          {title ?? derivedName}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <StatusIndicator state={state} />
          {statusLabels[state]}
        </span>
      </div>
      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "space-y-3 border-t border-border bg-background px-3 py-3 text-foreground outline-none",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
    <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      Input
    </h4>
    <div className="overflow-hidden rounded-md border border-border">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {errorText ? "Error" : "Output"}
      </h4>
      <div
        className={cn(
          "overflow-hidden overflow-x-auto rounded-md border text-xs [&_table]:w-full",
          errorText
            ? "border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
            : "border-border bg-background text-foreground",
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
