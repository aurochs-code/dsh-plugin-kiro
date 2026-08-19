import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
/** JSON-RPC error returned by Kiro's ACP server. */
export class AcpRpcError extends Error {
    code;
    data;
    constructor(message, code, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = 'AcpRpcError';
    }
}
/** Failure to start or communicate with the local Kiro CLI. */
export class KiroCliError extends Error {
    cause;
    constructor(message, cause) {
        super(message, cause === undefined ? undefined : { cause });
        this.cause = cause;
        this.name = 'KiroCliError';
    }
}
/** A small async queue for ACP notifications that arrive while a prompt is in flight. */
class AsyncQueue {
    values = [];
    pending;
    failure;
    closed = false;
    push(value) {
        if (this.closed)
            return;
        const pending = this.pending;
        if (pending !== undefined) {
            this.pending = undefined;
            pending.resolve({ value, done: false });
            return;
        }
        this.values.push(value);
    }
    end() {
        if (this.closed)
            return;
        this.closed = true;
        const pending = this.pending;
        if (pending !== undefined) {
            this.pending = undefined;
            pending.resolve({ value: undefined, done: true });
        }
    }
    fail(error) {
        if (this.closed)
            return;
        this.failure = error;
        this.closed = true;
        const pending = this.pending;
        if (pending !== undefined) {
            this.pending = undefined;
            pending.reject(error);
        }
    }
    async next() {
        if (this.values.length > 0)
            return { value: this.values.shift(), done: false };
        if (this.failure !== undefined)
            throw this.failure;
        if (this.closed)
            return { value: undefined, done: true };
        return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
    }
    [Symbol.asyncIterator]() {
        return { next: () => this.next() };
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function requiredString(params, name, allowEmpty = false) {
    const value = params[name];
    if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
        throw new KiroCliError(`Kiro ACP ${name} must be a non-empty string`);
    }
    return value;
}
function optionalInteger(params, name) {
    const value = params[name];
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new KiroCliError(`Kiro ACP ${name} must be a non-negative integer`);
    }
    return value;
}
function optionalStringArray(params, name) {
    const value = params[name];
    if (value === undefined || value === null)
        return undefined;
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new KiroCliError(`Kiro ACP ${name} must be an array of strings`);
    }
    return value;
}
function optionalEnvironment(params) {
    const value = params.env;
    if (value === undefined || value === null)
        return undefined;
    if (!Array.isArray(value))
        throw new KiroCliError('Kiro ACP env must be an array');
    return value.map((item) => {
        if (!isRecord(item))
            throw new KiroCliError('Kiro ACP env entries must be objects');
        return { name: requiredString(item, 'name'), value: requiredString(item, 'value', true) };
    });
}
function readTextFileRequest(params) {
    const line = optionalInteger(params, 'line');
    const limit = optionalInteger(params, 'limit');
    return {
        sessionId: requiredString(params, 'sessionId'),
        path: requiredString(params, 'path'),
        ...(line === undefined ? {} : { line }),
        ...(limit === undefined ? {} : { limit }),
    };
}
function writeTextFileRequest(params) {
    return {
        sessionId: requiredString(params, 'sessionId'),
        path: requiredString(params, 'path'),
        content: requiredString(params, 'content', true),
    };
}
function createTerminalRequest(params) {
    const args = optionalStringArray(params, 'args');
    const env = optionalEnvironment(params);
    const cwd = params.cwd === undefined || params.cwd === null ? undefined : requiredString(params, 'cwd');
    const outputByteLimit = optionalInteger(params, 'outputByteLimit');
    return {
        sessionId: requiredString(params, 'sessionId'),
        command: requiredString(params, 'command'),
        ...(args === undefined ? {} : { args }),
        ...(env === undefined ? {} : { env }),
        ...(cwd === undefined ? {} : { cwd }),
        ...(outputByteLimit === undefined ? {} : { outputByteLimit }),
    };
}
function terminalExitStatus(terminal) {
    return {
        ...(terminal.exitCode === null ? {} : { exitCode: terminal.exitCode }),
        ...(terminal.signal === null ? {} : { signal: terminal.signal }),
    };
}
function abortError() {
    return new Error('Kiro request was aborted');
}
function promptTextFromUpdate(params) {
    const update = isRecord(params.update) ? params.update : params;
    const kind = update.sessionUpdate ?? update.type ?? update.kind;
    if (kind !== 'agent_message_chunk' && kind !== 'AgentMessageChunk')
        return undefined;
    const content = update.content;
    if (isRecord(content) && content.type === 'text' && typeof content.text === 'string')
        return content.text;
    if (typeof update.text === 'string')
        return update.text;
    return undefined;
}
/** Minimal ACP client for Kiro CLI with optional DSH-mediated tool callbacks. */
export class KiroAcpClient {
    options;
    pending = new Map();
    prompts = new Map();
    promptSignals = new Map();
    terminals = new Map();
    process;
    nextId = 1;
    nextTerminalId = 1;
    exited = false;
    stderr = '';
    constructor(options) {
        this.options = options;
        try {
            this.process = spawn(options.command, [...(options.args ?? ['acp'])], {
                cwd: options.cwd,
                env: options.env,
                shell: false,
                stdio: 'pipe',
            });
        }
        catch (error) {
            throw new KiroCliError(`could not start Kiro CLI at ${options.command}`, error);
        }
        this.process.once('error', (error) => this.failAll(new KiroCliError(`could not start Kiro CLI at ${options.command}`, error)));
        this.process.once('exit', (code, signal) => {
            this.exited = true;
            const detail = this.stderr.trim();
            this.failAll(new KiroCliError(`Kiro ACP process exited${code === null ? '' : ` with code ${String(code)}`}${signal === null ? '' : ` (${signal})`}${detail.length === 0 ? '' : `: ${detail}`}`));
        });
        this.process.stderr.setEncoding('utf8');
        this.process.stderr.on('data', (chunk) => { this.stderr = (this.stderr + chunk).slice(-4_000); });
        const lines = createInterface({ input: this.process.stdout });
        lines.on('line', (line) => this.receive(line));
    }
    get isRunning() {
        return !this.exited;
    }
    async initialize(signal) {
        const handlers = this.options.handlers;
        const fs = handlers?.readTextFile === undefined && handlers?.writeTextFile === undefined
            ? undefined
            : {
                ...(handlers?.readTextFile === undefined ? {} : { readTextFile: true }),
                ...(handlers?.writeTextFile === undefined ? {} : { writeTextFile: true }),
            };
        await this.request('initialize', {
            protocolVersion: 1,
            clientCapabilities: {
                ...(fs === undefined ? {} : { fs }),
                ...(handlers?.createTerminal === undefined ? {} : { terminal: true }),
            },
            clientInfo: { name: 'dsh-plugin-kiro', version: '0.3.0' },
        }, signal);
    }
    async newSession(cwd, signal) {
        const result = await this.request('session/new', { cwd, mcpServers: [] }, signal);
        if (!isRecord(result) || typeof result.sessionId !== 'string' || result.sessionId.length === 0) {
            throw new KiroCliError('Kiro ACP returned no session id');
        }
        return result.sessionId;
    }
    async setModel(sessionId, modelId, signal) {
        await this.request('session/set_model', { sessionId, modelId }, signal);
    }
    /** Send one text prompt and yield Kiro's streamed text chunks. */
    async *prompt(sessionId, text, signal) {
        if (this.prompts.has(sessionId))
            throw new KiroCliError(`Kiro ACP session ${sessionId} already has an active prompt`);
        const queue = new AsyncQueue();
        this.prompts.set(sessionId, queue);
        this.promptSignals.set(sessionId, signal);
        let finished = false;
        const complete = async () => {
            try {
                // Current Kiro CLI releases require `prompt`. Some older ACP agents
                // use the documented `content` spelling, so retry only when they
                // explicitly reject the current form.
                try {
                    await this.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] }, signal);
                }
                catch (error) {
                    if (!(error instanceof AcpRpcError) || (error.code !== -32602 && !/invalid params/i.test(error.message)))
                        throw error;
                    await this.request('session/prompt', { sessionId, content: [{ type: 'text', text }] }, signal);
                }
                finished = true;
                queue.end();
            }
            catch (error) {
                queue.fail(error);
            }
        };
        void complete();
        try {
            for await (const chunk of queue)
                yield chunk;
        }
        finally {
            this.prompts.delete(sessionId);
            this.promptSignals.delete(sessionId);
            if (!finished)
                this.notify('session/cancel', { sessionId });
        }
    }
    close() {
        this.terminals.clear();
        this.promptSignals.clear();
        if (!this.exited)
            this.process.kill();
    }
    request(method, params, signal) {
        if (this.exited)
            return Promise.reject(new KiroCliError('Kiro ACP process is not running'));
        if (signal?.aborted === true)
            return Promise.reject(abortError());
        const id = this.nextId++;
        const request = { jsonrpc: '2.0', id, method, params };
        return new Promise((resolve, reject) => {
            const onAbort = () => {
                this.pending.delete(id);
                reject(abortError());
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            this.pending.set(id, {
                resolve,
                reject,
                removeAbort: () => signal?.removeEventListener('abort', onAbort),
            });
            try {
                this.process.stdin.write(`${JSON.stringify(request)}\n`);
            }
            catch (error) {
                this.pending.delete(id);
                signal?.removeEventListener('abort', onAbort);
                reject(new KiroCliError('could not write to Kiro ACP process', error));
            }
        });
    }
    notify(method, params) {
        if (this.exited)
            return;
        try {
            this.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
        }
        catch {
            // The request failure path will surface the process error if it is still relevant.
        }
    }
    receive(line) {
        if (line.trim().length === 0)
            return;
        let message;
        try {
            message = JSON.parse(line);
        }
        catch {
            this.failAll(new KiroCliError(`Kiro ACP emitted malformed JSON: ${line.slice(0, 160)}`));
            return;
        }
        if (message.method !== undefined) {
            if (message.id !== undefined) {
                void this.handleClientRequest(message.id, message.method, message.params ?? {});
                return;
            }
            this.receiveNotification(message.method, message.params);
            return;
        }
        if (typeof message.id === 'number') {
            const deferred = this.pending.get(message.id);
            if (deferred === undefined)
                return;
            this.pending.delete(message.id);
            deferred.removeAbort();
            if (message.error !== undefined) {
                deferred.reject(new AcpRpcError(message.error.message ?? 'Kiro ACP request failed', message.error.code, message.error.data));
            }
            else {
                deferred.resolve(message.result);
            }
            return;
        }
    }
    receiveNotification(method, params) {
        if (method !== 'session/update' && method !== 'session/notification')
            return;
        if (params === undefined || typeof params.sessionId !== 'string')
            return;
        const queue = this.prompts.get(params.sessionId);
        if (queue === undefined)
            return;
        const text = promptTextFromUpdate(params);
        if (text !== undefined)
            queue.push(text);
        // Kiro reports ToolCall and ToolCallUpdate as status notifications. Actual
        // DSH-mediated file or terminal work arrives as an ACP client request and
        // is handled separately in receive() before this notification path.
    }
    async handleClientRequest(id, method, params) {
        try {
            const handlers = this.options.handlers;
            if (method === 'fs/read_text_file') {
                if (handlers?.readTextFile === undefined)
                    return this.replyUnsupported(id);
                const request = readTextFileRequest(params);
                const content = await handlers.readTextFile(request, this.promptSignals.get(request.sessionId));
                this.replyResult(id, { content });
                return;
            }
            if (method === 'fs/write_text_file') {
                if (handlers?.writeTextFile === undefined)
                    return this.replyUnsupported(id);
                const request = writeTextFileRequest(params);
                await handlers.writeTextFile(request, this.promptSignals.get(request.sessionId));
                this.replyResult(id, {});
                return;
            }
            if (method === 'terminal/create') {
                if (handlers?.createTerminal === undefined)
                    return this.replyUnsupported(id);
                const request = createTerminalRequest(params);
                const terminal = await handlers.createTerminal(request, this.promptSignals.get(request.sessionId));
                const terminalId = `dsh-terminal-${this.nextTerminalId++}`;
                this.terminals.set(terminalId, terminal);
                this.replyResult(id, { terminalId });
                return;
            }
            if (method === 'terminal/output') {
                const terminal = this.terminal(params);
                this.replyResult(id, {
                    output: terminal.output,
                    truncated: terminal.truncated,
                    ...(terminal.exitCode === null && terminal.signal === null ? {} : { exitStatus: terminalExitStatus(terminal) }),
                });
                return;
            }
            if (method === 'terminal/wait_for_exit') {
                this.replyResult(id, { exitStatus: terminalExitStatus(this.terminal(params)) });
                return;
            }
            if (method === 'terminal/kill') {
                this.terminal(params);
                this.replyResult(id, {});
                return;
            }
            if (method === 'terminal/release') {
                this.terminals.delete(requiredString(params, 'terminalId'));
                this.replyResult(id, {});
                return;
            }
            if (method === 'session/request_permission') {
                this.replyError(id, -32601, 'Kiro permission requests must use DSH-mediated file or terminal capabilities');
                return;
            }
            this.replyUnsupported(id);
        }
        catch (error) {
            this.replyError(id, -32000, error instanceof Error ? error.message : String(error));
        }
    }
    terminal(params) {
        const terminalId = requiredString(params, 'terminalId');
        const terminal = this.terminals.get(terminalId);
        if (terminal === undefined)
            throw new KiroCliError(`unknown ACP terminal ${terminalId}`);
        return terminal;
    }
    replyResult(id, result) {
        try {
            this.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
        }
        catch {
            // The child-process error path owns the user-facing diagnostic.
        }
    }
    replyUnsupported(id) {
        this.replyError(id, -32601, 'dsh-plugin-kiro does not expose this ACP client capability');
    }
    replyError(id, code, message) {
        try {
            this.process.stdin.write(`${JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code, message },
            })}\n`);
        }
        catch {
            // The child-process error path owns the user-facing diagnostic.
        }
    }
    failAll(error) {
        for (const deferred of this.pending.values()) {
            deferred.removeAbort();
            deferred.reject(error);
        }
        this.pending.clear();
        for (const queue of this.prompts.values())
            queue.fail(error);
        this.prompts.clear();
    }
}
