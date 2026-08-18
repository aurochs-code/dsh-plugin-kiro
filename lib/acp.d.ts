/** JSON-RPC error returned by Kiro's ACP server. */
export declare class AcpRpcError extends Error {
    readonly code?: number | undefined;
    readonly data?: unknown | undefined;
    constructor(message: string, code?: number | undefined, data?: unknown | undefined);
}
/** Failure to start or communicate with the local Kiro CLI. */
export declare class KiroCliError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
/** Launch options for a single Kiro ACP process. */
export interface KiroAcpClientOptions {
    command: string;
    args?: readonly string[];
    cwd: string;
    env?: NodeJS.ProcessEnv;
}
/**
 * Minimal ACP client for Kiro CLI. It intentionally advertises no file-system
 * or terminal capabilities: DSH owns tool execution, while this adapter only
 * accepts text model output.
 */
export declare class KiroAcpClient {
    private readonly options;
    private readonly pending;
    private readonly prompts;
    private readonly process;
    private nextId;
    private exited;
    private stderr;
    constructor(options: KiroAcpClientOptions);
    initialize(signal?: AbortSignal): Promise<void>;
    newSession(cwd: string, signal?: AbortSignal): Promise<string>;
    setModel(sessionId: string, modelId: string, signal?: AbortSignal): Promise<void>;
    /** Send one text prompt and yield Kiro's streamed text chunks. */
    prompt(sessionId: string, text: string, signal?: AbortSignal): AsyncGenerator<string>;
    close(): void;
    private request;
    private notify;
    private receive;
    private replyUnsupported;
    private failAll;
}
