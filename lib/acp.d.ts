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
    handlers?: KiroAcpClientHandlers;
}
/** One file-read request issued by Kiro through the ACP client boundary. */
export interface KiroAcpReadTextFileRequest {
    sessionId: string;
    path: string;
    line?: number;
    limit?: number;
}
/** One file-write request issued by Kiro through the ACP client boundary. */
export interface KiroAcpWriteTextFileRequest {
    sessionId: string;
    path: string;
    content: string;
}
/** Environment variable supplied with an ACP terminal request. */
export interface KiroAcpEnvironmentVariable {
    name: string;
    value: string;
}
/** One terminal request issued by Kiro through the ACP client boundary. */
export interface KiroAcpCreateTerminalRequest {
    sessionId: string;
    command: string;
    args?: readonly string[];
    env?: readonly KiroAcpEnvironmentVariable[];
    cwd?: string;
    outputByteLimit?: number;
}
/** Completed DSH-backed terminal state retained for ACP terminal follow-ups. */
export interface KiroAcpTerminal {
    output: string;
    truncated: boolean;
    exitCode: number | null;
    signal: string | null;
}
/** Optional DSH-mediated capabilities exposed to one Kiro ACP session. */
export interface KiroAcpClientHandlers {
    readTextFile?(request: KiroAcpReadTextFileRequest, signal?: AbortSignal): Promise<string>;
    writeTextFile?(request: KiroAcpWriteTextFileRequest, signal?: AbortSignal): Promise<void>;
    createTerminal?(request: KiroAcpCreateTerminalRequest, signal?: AbortSignal): Promise<KiroAcpTerminal>;
}
/** Minimal ACP client for Kiro CLI with optional DSH-mediated tool callbacks. */
export declare class KiroAcpClient {
    private readonly options;
    private readonly pending;
    private readonly prompts;
    private readonly promptSignals;
    private readonly terminals;
    private readonly process;
    private nextId;
    private nextTerminalId;
    private exited;
    private stderr;
    constructor(options: KiroAcpClientOptions);
    get isRunning(): boolean;
    initialize(signal?: AbortSignal): Promise<void>;
    newSession(cwd: string, signal?: AbortSignal): Promise<string>;
    setModel(sessionId: string, modelId: string, signal?: AbortSignal): Promise<void>;
    /** Send one text prompt and yield Kiro's streamed text chunks. */
    prompt(sessionId: string, text: string, signal?: AbortSignal): AsyncGenerator<string>;
    close(): void;
    private request;
    private notify;
    private receive;
    private receiveNotification;
    private handleClientRequest;
    private terminal;
    private replyResult;
    private replyUnsupported;
    private replyError;
    private failAll;
}
