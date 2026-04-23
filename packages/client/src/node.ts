import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import {
  buildPiUiEvents,
  createPiUiState,
  type PiAgentMessage,
  type PiCommandAck,
  type PiImageContent,
  type PiProcessExit,
  type PiPromptRequest,
  type PiRpcCommandInput,
  type PiRpcEvent,
  type PiRpcResponse,
  type PiRpcSessionState,
  type PiSessionStats,
  type PiThinkingLevel,
  type PiTransportEvent,
  type PiUiEvent,
  type PiUiState,
  unwrapPiResponse,
  reducePiTransportEvent,
} from "./shared.js";
import { attachJsonlStreamReader, serializeJsonLine } from "./jsonl.js";

type Listener<TPayload> = (payload: TPayload) => void;

class ListenerSet<TPayload> {
  #listeners = new Set<Listener<TPayload>>();

  subscribe(listener: Listener<TPayload>): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  publish(payload: TPayload): void {
    for (const listener of this.#listeners) {
      listener(payload);
    }
  }

  clear(): void {
    this.#listeners.clear();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRpcResponse(value: unknown): value is PiRpcResponse<unknown> {
  return (
    isRecord(value) &&
    value.type === "response" &&
    typeof value.command === "string" &&
    typeof value.success === "boolean"
  );
}

interface PendingRequest {
  resolve: (response: PiRpcResponse<unknown>) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface PiRpcClientOptions {
  bin?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  provider?: string;
  model?: string;
  thinking?: PiThinkingLevel;
  sessionMode?: "ephemeral" | "persistent";
  sessionDir?: string;
  tools?: string[];
  extraArgs?: string[];
  startupTimeoutMs?: number;
  responseTimeoutMs?: number;
  stopTimeoutMs?: number;
}

export class PiRpcClient {
  readonly sessionId: string;

  #options: PiRpcClientOptions;
  #process: ChildProcessWithoutNullStreams | null = null;
  #stopReadingStdout: (() => void) | null = null;
  #pendingRequests = new Map<string, PendingRequest>();
  #requestCounter = 0;
  #stderr = "";
  #rawListeners = new ListenerSet<PiRpcEvent>();
  #uiListeners = new ListenerSet<PiUiEvent>();
  #stderrListeners = new ListenerSet<string>();
  #exitListeners = new ListenerSet<PiProcessExit>();
  #explicitStop = false;

  constructor(sessionId: string, options: PiRpcClientOptions = {}) {
    this.sessionId = sessionId;
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#process !== null && this.#process.exitCode === null;
  }

  get stderr(): string {
    return this.#stderr;
  }

  onRawEvent(listener: Listener<PiRpcEvent>): () => void {
    return this.#rawListeners.subscribe(listener);
  }

  onUiEvent(listener: Listener<PiUiEvent>): () => void {
    return this.#uiListeners.subscribe(listener);
  }

  onStderr(listener: Listener<string>): () => void {
    return this.#stderrListeners.subscribe(listener);
  }

  onExit(listener: Listener<PiProcessExit>): () => void {
    return this.#exitListeners.subscribe(listener);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.#emitUi({
      type: "session.status",
      sessionId: this.sessionId,
      status: "starting",
      at: new Date().toISOString(),
    });

    const args = ["--mode", "rpc"];

    if (this.#options.sessionMode !== "persistent") {
      args.push("--no-session");
    } else if (this.#options.sessionDir) {
      args.push("--session-dir", this.#options.sessionDir);
    }

    if (this.#options.provider) {
      args.push("--provider", this.#options.provider);
    }

    if (this.#options.model) {
      args.push("--model", this.#options.model);
    }

    if (this.#options.thinking) {
      args.push("--thinking", this.#options.thinking);
    }

    if (this.#options.tools && this.#options.tools.length > 0) {
      args.push("--tools", this.#options.tools.join(","));
    }

    if (this.#options.extraArgs && this.#options.extraArgs.length > 0) {
      args.push(...this.#options.extraArgs);
    }

    const processHandle = spawn(this.#options.bin ?? "pi", args, {
      cwd: this.#options.cwd,
      env: {
        ...process.env,
        ...this.#options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.#process = processHandle;

    processHandle.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      this.#stderr += text;
      this.#stderrListeners.publish(text);
    });

    this.#stopReadingStdout = attachJsonlStreamReader(
      processHandle.stdout,
      (line) => {
        this.#handleStdoutLine(line);
      },
    );

    processHandle.once("error", (error) => {
      this.#handleProcessFailure(error);
    });

    processHandle.once("close", (code, signal) => {
      this.#handleClose(code, signal);
    });

    await this.#waitForStartup();

    this.#emitUi({
      type: "session.status",
      sessionId: this.sessionId,
      status: "idle",
      at: new Date().toISOString(),
    });
  }

  async stop(): Promise<void> {
    if (!this.#process) {
      return;
    }

    const processHandle = this.#process;
    this.#explicitStop = true;
    processHandle.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        processHandle.kill("SIGKILL");
        resolve();
      }, this.#options.stopTimeoutMs ?? 1_000);

      processHandle.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.#explicitStop = false;
  }

  async command<TData = unknown>(
    command: PiRpcCommandInput,
  ): Promise<PiRpcResponse<TData>> {
    await this.start();

    if (!this.#process) {
      throw new Error("Pi RPC process is not available");
    }

    const id = `pi-web-${this.sessionId}-${++this.#requestCounter}`;
    const payload = {
      ...command,
      id,
    };

    return await new Promise<PiRpcResponse<TData>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingRequests.delete(id);
        reject(
          new Error(
            `Timed out waiting for response to "${command.type}".\n${this.#stderr}`,
          ),
        );
      }, this.#options.responseTimeoutMs ?? 30_000);

      this.#pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response as PiRpcResponse<TData>);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      this.#process?.stdin.write(serializeJsonLine(payload), (error) => {
        if (error) {
          const pending = this.#pendingRequests.get(id);

          if (!pending) {
            return;
          }

          this.#pendingRequests.delete(id);
          clearTimeout(pending.timeout);
          pending.reject(error);
        }
      });
    });
  }

  async prompt(
    message: string,
    options: Pick<PiPromptRequest, "images" | "streamingBehavior"> = {},
  ): Promise<PiCommandAck> {
    const response = await this.command({
      type: "prompt",
      message,
      ...options,
    });

    unwrapPiResponse(response);
    return { sessionId: this.sessionId, accepted: true };
  }

  async steer(
    message: string,
    images?: PiImageContent[],
  ): Promise<PiCommandAck> {
    const response = await this.command({
      type: "steer",
      message,
      images,
    });

    unwrapPiResponse(response);
    return { sessionId: this.sessionId, accepted: true };
  }

  async followUp(
    message: string,
    images?: PiImageContent[],
  ): Promise<PiCommandAck> {
    const response = await this.command({
      type: "follow_up",
      message,
      images,
    });

    unwrapPiResponse(response);
    return { sessionId: this.sessionId, accepted: true };
  }

  async abort(): Promise<PiCommandAck> {
    const response = await this.command({
      type: "abort",
    });

    unwrapPiResponse(response);
    return { sessionId: this.sessionId, accepted: true };
  }

  async getState(): Promise<PiRpcSessionState> {
    const response = await this.command<PiRpcSessionState>({
      type: "get_state",
    });

    return unwrapPiResponse(response) ?? {};
  }

  async getMessages(): Promise<PiAgentMessage[]> {
    const response = await this.command<{ messages: PiAgentMessage[] }>({
      type: "get_messages",
    });

    return unwrapPiResponse(response)?.messages ?? [];
  }

  async getSessionStats(): Promise<PiSessionStats> {
    const response = await this.command<PiSessionStats>({
      type: "get_session_stats",
    });

    return unwrapPiResponse(response) ?? {};
  }

  async waitForIdle(timeoutMs = 60_000): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for Pi to go idle.\n${this.#stderr}`));
      }, timeoutMs);

      const unsubscribe = this.onUiEvent((event) => {
        if (event.type !== "agent.ended") {
          return;
        }

        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });
  }

  async collectUntilIdle(timeoutMs = 60_000): Promise<PiUiEvent[]> {
    const events: PiUiEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out collecting Pi events.\n${this.#stderr}`));
      }, timeoutMs);

      const unsubscribe = this.onUiEvent((event) => {
        events.push(event);

        if (event.type !== "agent.ended") {
          return;
        }

        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });

    return events;
  }

  async promptAndWait(
    message: string,
    options: Pick<PiPromptRequest, "images" | "streamingBehavior"> = {},
    timeoutMs = 60_000,
  ): Promise<PiUiEvent[]> {
    const pendingEvents = this.collectUntilIdle(timeoutMs);
    await this.prompt(message, options);
    return await pendingEvents;
  }

  async #waitForStartup(): Promise<void> {
    const processHandle = this.#process;

    if (!processHandle) {
      throw new Error("Pi RPC process was not created");
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        processHandle.off("close", onClose);
        resolve();
      }, this.#options.startupTimeoutMs ?? 120);

      const onClose = (code: number | null) => {
        clearTimeout(timer);
        reject(
          new Error(
            `Pi RPC process exited during startup with code ${code}.\n${this.#stderr}`,
          ),
        );
      };

      processHandle.once("close", onClose);
    });
  }

  #handleStdoutLine(line: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(line) as PiRpcEvent | PiRpcResponse<unknown>;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error";
      this.#emitUi({
        type: "session.error",
        sessionId: this.sessionId,
        at: new Date().toISOString(),
        source: "parse",
        message: `Failed to parse Pi RPC stdout line: ${message}`,
      });
      return;
    }

    if (isRpcResponse(parsed)) {
      if (parsed.id && this.#pendingRequests.has(parsed.id)) {
        const pending = this.#pendingRequests.get(parsed.id);

        if (!pending) {
          return;
        }

        this.#pendingRequests.delete(parsed.id);
        pending.resolve(parsed);
        return;
      }

      if (!parsed.success) {
        this.#emitUi({
          type: "session.error",
          sessionId: this.sessionId,
          at: new Date().toISOString(),
          source: "rpc",
          message: parsed.error,
        });
      }

      return;
    }

    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return;
    }

    const event = parsed as PiRpcEvent;

    this.#rawListeners.publish(event);

    for (const uiEvent of buildPiUiEvents(this.sessionId, event)) {
      this.#emitUi(uiEvent);
    }
  }

  #handleProcessFailure(error: Error): void {
    this.#rejectAllPending(error);
    this.#emitUi({
      type: "session.error",
      sessionId: this.sessionId,
      at: new Date().toISOString(),
      source: "process",
      message: error.message,
    });
    this.#emitUi({
      type: "session.status",
      sessionId: this.sessionId,
      status: "error",
      at: new Date().toISOString(),
      reason: error.message,
    });
  }

  #handleClose(code: number | null, signal: NodeJS.Signals | null): void {
    this.#stopReadingStdout?.();
    this.#stopReadingStdout = null;
    this.#process = null;

    const exit: PiProcessExit = {
      code,
      signal,
      stderr: this.#stderr,
    };

    if (this.#explicitStop) {
      this.#emitUi({
        type: "session.status",
        sessionId: this.sessionId,
        status: "stopped",
        at: new Date().toISOString(),
      });
    } else {
      const reason = `Pi RPC process exited unexpectedly (code: ${code}, signal: ${signal ?? "none"}).`;
      this.#rejectAllPending(new Error(reason));
      this.#emitUi({
        type: "session.error",
        sessionId: this.sessionId,
        at: new Date().toISOString(),
        source: "process",
        message: `${reason}\n${this.#stderr}`.trim(),
      });
      this.#emitUi({
        type: "session.status",
        sessionId: this.sessionId,
        status: "error",
        at: new Date().toISOString(),
        reason,
      });
    }

    this.#exitListeners.publish(exit);
  }

  #rejectAllPending(error: Error): void {
    for (const [requestId, pending] of this.#pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.#pendingRequests.delete(requestId);
    }
  }

  #emitUi(event: PiUiEvent): void {
    this.#uiListeners.publish(event);
  }
}

export interface PiSessionOptions {
  sessionId: string;
  clientOptions?: PiRpcClientOptions;
}

export class PiSession {
  readonly sessionId: string;

  #clientOptions: PiRpcClientOptions;
  #client: PiRpcClient;
  #events = new ListenerSet<PiTransportEvent>();
  #state: PiUiState;
  #lastTouchedAt = Date.now();

  constructor(options: PiSessionOptions) {
    this.sessionId = options.sessionId;
    this.#clientOptions = options.clientOptions ?? {};
    this.#client = this.#createClient();
    this.#state = createPiUiState(this.sessionId);
  }

  get snapshot(): PiUiState {
    return this.#state;
  }

  get lastTouchedAt(): number {
    return this.#lastTouchedAt;
  }

  async ensureStarted(): Promise<void> {
    this.#touch();
    await this.#client.start();
  }

  subscribe(
    listener: Listener<PiTransportEvent>,
    options: { replaySnapshot?: boolean } = {},
  ): () => void {
    if (options.replaySnapshot !== false) {
      listener({
        type: "snapshot",
        snapshot: this.#state,
      });
    }

    return this.#events.subscribe(listener);
  }

  async prompt(
    message: string,
    options: Pick<PiPromptRequest, "images" | "streamingBehavior"> = {},
  ): Promise<PiCommandAck> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.prompt(message, options);
  }

  async steer(message: string, images?: PiImageContent[]): Promise<PiCommandAck> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.steer(message, images);
  }

  async followUp(
    message: string,
    images?: PiImageContent[],
  ): Promise<PiCommandAck> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.followUp(message, images);
  }

  async abort(): Promise<PiCommandAck> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.abort();
  }

  async getState(): Promise<PiRpcSessionState> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.getState();
  }

  async getMessages(): Promise<PiAgentMessage[]> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.getMessages();
  }

  async getSessionStats(): Promise<PiSessionStats> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.getSessionStats();
  }

  async send<TData = unknown>(
    command: PiRpcCommandInput,
  ): Promise<PiRpcResponse<TData>> {
    this.#touch();
    await this.ensureStarted();
    return await this.#client.command<TData>(command);
  }

  async dispose(): Promise<void> {
    await this.#client.stop();
  }

  async restart(): Promise<void> {
    await this.#client.stop();
    this.#client = this.#createClient();
    this.#state = createPiUiState(this.sessionId);
    this.#events.publish({
      type: "snapshot",
      snapshot: this.#state,
    });
  }

  #createClient(): PiRpcClient {
    const client = new PiRpcClient(this.sessionId, this.#clientOptions);
    client.onUiEvent((event) => {
      this.#touch();
      this.#state = reducePiTransportEvent(this.#state, event);
      this.#events.publish(event);
    });

    client.onExit(() => {
      this.#touch();
    });

    return client;
  }

  #touch(): void {
    this.#lastTouchedAt = Date.now();
  }
}

export interface PiSessionRegistryOptions {
  idleTtlMs?: number;
  maxSessions?: number;
  cleanupIntervalMs?: number;
  createClientOptions?: (sessionId: string) => PiRpcClientOptions;
}

export class PiSessionRegistry {
  #sessions = new Map<string, PiSession>();
  #idleTtlMs: number;
  #maxSessions: number;
  #cleanupTimer: ReturnType<typeof setInterval> | null = null;
  #createClientOptions: (sessionId: string) => PiRpcClientOptions;

  constructor(options: PiSessionRegistryOptions = {}) {
    this.#idleTtlMs = options.idleTtlMs ?? 10 * 60_000;
    this.#maxSessions = options.maxSessions ?? 100;
    this.#createClientOptions =
      options.createClientOptions ?? (() => ({ sessionMode: "ephemeral" }));

    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000;
    this.#cleanupTimer = setInterval(() => {
      void this.pruneIdleSessions();
    }, cleanupIntervalMs);
  }

  get size(): number {
    return this.#sessions.size;
  }

  has(sessionId: string): boolean {
    return this.#sessions.has(sessionId);
  }

  getOrCreate(sessionId: string): PiSession {
    const existing = this.#sessions.get(sessionId);

    if (existing) {
      return existing;
    }

    if (this.#sessions.size >= this.#maxSessions) {
      void this.pruneIdleSessions();
    }

    const session = new PiSession({
      sessionId,
      clientOptions: this.#createClientOptions(sessionId),
    });

    this.#sessions.set(sessionId, session);
    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.#sessions.get(sessionId);

    if (!session) {
      return;
    }

    this.#sessions.delete(sessionId);
    await session.dispose();
  }

  async pruneIdleSessions(now = Date.now()): Promise<void> {
    const candidates = [...this.#sessions.values()].filter((session) => {
      const age = now - session.lastTouchedAt;
      return age >= this.#idleTtlMs;
    });

    for (const session of candidates) {
      await this.destroySession(session.sessionId);
    }

    if (this.#sessions.size < this.#maxSessions) {
      return;
    }

    const oldest = [...this.#sessions.values()].sort(
      (left, right) => left.lastTouchedAt - right.lastTouchedAt,
    )[0];

    if (oldest) {
      await this.destroySession(oldest.sessionId);
    }
  }

  async dispose(): Promise<void> {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }

    const sessions = [...this.#sessions.values()];
    this.#sessions.clear();

    for (const session of sessions) {
      await session.dispose();
    }
  }
}
