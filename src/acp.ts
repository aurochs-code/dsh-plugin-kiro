import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

/** JSON-RPC error returned by Kiro's ACP server. */
export class AcpRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: unknown,
  ) {
    super(message)
    this.name = 'AcpRpcError'
  }
}

/** Failure to start or communicate with the local Kiro CLI. */
export class KiroCliError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'KiroCliError'
  }
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

type JsonRpcId = string | number | null

interface JsonRpcResponse {
  jsonrpc?: string
  id?: JsonRpcId
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
  method?: string
  params?: Record<string, unknown>
}

interface Deferred<T> {
  resolve(value: T): void
  reject(error: unknown): void
  removeAbort(): void
}

/** A small async queue for ACP notifications that arrive while a prompt is in flight. */
class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private pending: { resolve(result: IteratorResult<T>): void; reject(error: unknown): void } | undefined
  private failure: unknown
  private closed = false

  push(value: T): void {
    if (this.closed) return
    const pending = this.pending
    if (pending !== undefined) {
      this.pending = undefined
      pending.resolve({ value, done: false })
      return
    }
    this.values.push(value)
  }

  end(): void {
    if (this.closed) return
    this.closed = true
    const pending = this.pending
    if (pending !== undefined) {
      this.pending = undefined
      pending.resolve({ value: undefined, done: true })
    }
  }

  fail(error: unknown): void {
    if (this.closed) return
    this.failure = error
    this.closed = true
    const pending = this.pending
    if (pending !== undefined) {
      this.pending = undefined
      pending.reject(error)
    }
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.values.length > 0) return { value: this.values.shift()!, done: false }
    if (this.failure !== undefined) throw this.failure
    if (this.closed) return { value: undefined, done: true }
    return new Promise<IteratorResult<T>>((resolve, reject) => { this.pending = { resolve, reject } })
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return { next: () => this.next() }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(params: Record<string, unknown>, name: string, allowEmpty = false): string {
  const value = params[name]
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new KiroCliError(`Kiro ACP ${name} must be a non-empty string`)
  }
  return value
}

function optionalInteger(params: Record<string, unknown>, name: string): number | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new KiroCliError(`Kiro ACP ${name} must be a non-negative integer`)
  }
  return value
}

function optionalStringArray(params: Record<string, unknown>, name: string): readonly string[] | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new KiroCliError(`Kiro ACP ${name} must be an array of strings`)
  }
  return value
}

function optionalEnvironment(params: Record<string, unknown>): readonly KiroAcpEnvironmentVariable[] | undefined {
  const value = params.env
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) throw new KiroCliError('Kiro ACP env must be an array')
  return value.map((item) => {
    if (!isRecord(item)) throw new KiroCliError('Kiro ACP env entries must be objects')
    return { name: requiredString(item, 'name'), value: requiredString(item, 'value', true) }
  })
}

function readTextFileRequest(params: Record<string, unknown>): KiroAcpReadTextFileRequest {
  const line = optionalInteger(params, 'line')
  const limit = optionalInteger(params, 'limit')
  return {
    sessionId: requiredString(params, 'sessionId'),
    path: requiredString(params, 'path'),
    ...(line === undefined ? {} : { line }),
    ...(limit === undefined ? {} : { limit }),
  }
}

function writeTextFileRequest(params: Record<string, unknown>): KiroAcpWriteTextFileRequest {
  return {
    sessionId: requiredString(params, 'sessionId'),
    path: requiredString(params, 'path'),
    content: requiredString(params, 'content', true),
  }
}

function createTerminalRequest(params: Record<string, unknown>): KiroAcpCreateTerminalRequest {
  const args = optionalStringArray(params, 'args')
  const env = optionalEnvironment(params)
  const cwd = params.cwd === undefined || params.cwd === null ? undefined : requiredString(params, 'cwd')
  const outputByteLimit = optionalInteger(params, 'outputByteLimit')
  return {
    sessionId: requiredString(params, 'sessionId'),
    command: requiredString(params, 'command'),
    ...(args === undefined ? {} : { args }),
    ...(env === undefined ? {} : { env }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(outputByteLimit === undefined ? {} : { outputByteLimit }),
  }
}

function terminalExitStatus(terminal: KiroAcpTerminal): Record<string, string | number> {
  return {
    ...(terminal.exitCode === null ? {} : { exitCode: terminal.exitCode }),
    ...(terminal.signal === null ? {} : { signal: terminal.signal }),
  }
}

function abortError(): Error {
  return new Error('Kiro request was aborted')
}

function promptTextFromUpdate(params: Record<string, unknown>): string | undefined {
  const update = isRecord(params.update) ? params.update : params
  const kind = update.sessionUpdate ?? update.type ?? update.kind
  if (kind !== 'agent_message_chunk' && kind !== 'AgentMessageChunk') return undefined
  const content = update.content
  if (isRecord(content) && content.type === 'text' && typeof content.text === 'string') return content.text
  if (typeof update.text === 'string') return update.text
  return undefined
}

/** Launch options for a single Kiro ACP process. */
export interface KiroAcpClientOptions {
  command: string
  args?: readonly string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  handlers?: KiroAcpClientHandlers
}

/** One file-read request issued by Kiro through the ACP client boundary. */
export interface KiroAcpReadTextFileRequest {
  sessionId: string
  path: string
  line?: number
  limit?: number
}

/** One file-write request issued by Kiro through the ACP client boundary. */
export interface KiroAcpWriteTextFileRequest {
  sessionId: string
  path: string
  content: string
}

/** Environment variable supplied with an ACP terminal request. */
export interface KiroAcpEnvironmentVariable {
  name: string
  value: string
}

/** One terminal request issued by Kiro through the ACP client boundary. */
export interface KiroAcpCreateTerminalRequest {
  sessionId: string
  command: string
  args?: readonly string[]
  env?: readonly KiroAcpEnvironmentVariable[]
  cwd?: string
  outputByteLimit?: number
}

/** Completed DSH-backed terminal state retained for ACP terminal follow-ups. */
export interface KiroAcpTerminal {
  output: string
  truncated: boolean
  exitCode: number | null
  signal: string | null
}

/** Optional DSH-mediated capabilities exposed to one Kiro ACP session. */
export interface KiroAcpClientHandlers {
  readTextFile?(request: KiroAcpReadTextFileRequest, signal?: AbortSignal): Promise<string>
  writeTextFile?(request: KiroAcpWriteTextFileRequest, signal?: AbortSignal): Promise<void>
  createTerminal?(request: KiroAcpCreateTerminalRequest, signal?: AbortSignal): Promise<KiroAcpTerminal>
}

/** Minimal ACP client for Kiro CLI with optional DSH-mediated tool callbacks. */
export class KiroAcpClient {
  private readonly pending = new Map<number, Deferred<unknown>>()
  private readonly prompts = new Map<string, AsyncQueue<string>>()
  private readonly promptSignals = new Map<string, AbortSignal | undefined>()
  private readonly terminals = new Map<string, KiroAcpTerminal>()
  private readonly process: ChildProcessWithoutNullStreams
  private nextId = 1
  private nextTerminalId = 1
  private exited = false
  private stderr = ''

  constructor(private readonly options: KiroAcpClientOptions) {
    try {
      this.process = spawn(options.command, [...(options.args ?? ['acp'])], {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: 'pipe',
      })
    } catch (error) {
      throw new KiroCliError(`could not start Kiro CLI at ${options.command}`, error)
    }
    this.process.once('error', (error) => this.failAll(new KiroCliError(`could not start Kiro CLI at ${options.command}`, error)))
    this.process.once('exit', (code, signal) => {
      this.exited = true
      const detail = this.stderr.trim()
      this.failAll(new KiroCliError(
        `Kiro ACP process exited${code === null ? '' : ` with code ${String(code)}`}${signal === null ? '' : ` (${signal})`}${detail.length === 0 ? '' : `: ${detail}`}`,
      ))
    })
    this.process.stderr.setEncoding('utf8')
    this.process.stderr.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-4_000) })
    const lines = createInterface({ input: this.process.stdout })
    lines.on('line', (line) => this.receive(line))
  }

  get isRunning(): boolean {
    return !this.exited
  }

  async initialize(signal?: AbortSignal): Promise<void> {
    const handlers = this.options.handlers
    const fs = handlers?.readTextFile === undefined && handlers?.writeTextFile === undefined
      ? undefined
      : {
          ...(handlers?.readTextFile === undefined ? {} : { readTextFile: true }),
          ...(handlers?.writeTextFile === undefined ? {} : { writeTextFile: true }),
        }
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        ...(fs === undefined ? {} : { fs }),
        ...(handlers?.createTerminal === undefined ? {} : { terminal: true }),
      },
      clientInfo: { name: 'dsh-plugin-kiro', version: '0.3.0' },
    }, signal)
  }

  async newSession(cwd: string, signal?: AbortSignal): Promise<string> {
    const result = await this.request('session/new', { cwd, mcpServers: [] }, signal)
    if (!isRecord(result) || typeof result.sessionId !== 'string' || result.sessionId.length === 0) {
      throw new KiroCliError('Kiro ACP returned no session id')
    }
    return result.sessionId
  }

  async setModel(sessionId: string, modelId: string, signal?: AbortSignal): Promise<void> {
    await this.request('session/set_model', { sessionId, modelId }, signal)
  }

  /** Send one text prompt and yield Kiro's streamed text chunks. */
  async *prompt(sessionId: string, text: string, signal?: AbortSignal): AsyncGenerator<string> {
    if (this.prompts.has(sessionId)) throw new KiroCliError(`Kiro ACP session ${sessionId} already has an active prompt`)
    const queue = new AsyncQueue<string>()
    this.prompts.set(sessionId, queue)
    this.promptSignals.set(sessionId, signal)
    let finished = false
    const complete = async (): Promise<void> => {
      try {
        // Current Kiro CLI releases require `prompt`. Some older ACP agents
        // use the documented `content` spelling, so retry only when they
        // explicitly reject the current form.
        try {
          await this.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] }, signal)
        } catch (error) {
          if (!(error instanceof AcpRpcError) || (error.code !== -32602 && !/invalid params/i.test(error.message))) throw error
          await this.request('session/prompt', { sessionId, content: [{ type: 'text', text }] }, signal)
        }
        finished = true
        queue.end()
      } catch (error) {
        queue.fail(error)
      }
    }
    void complete()
    try {
      for await (const chunk of queue) yield chunk
    } finally {
      this.prompts.delete(sessionId)
      this.promptSignals.delete(sessionId)
      if (!finished) this.notify('session/cancel', { sessionId })
    }
  }

  close(): void {
    this.terminals.clear()
    this.promptSignals.clear()
    if (!this.exited) this.process.kill()
  }

  private request(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    if (this.exited) return Promise.reject(new KiroCliError('Kiro ACP process is not running'))
    if (signal?.aborted === true) return Promise.reject(abortError())
    const id = this.nextId++
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    return new Promise<unknown>((resolve, reject) => {
      const onAbort = (): void => {
        this.pending.delete(id)
        reject(abortError())
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      this.pending.set(id, {
        resolve,
        reject,
        removeAbort: () => signal?.removeEventListener('abort', onAbort),
      })
      try {
        this.process.stdin.write(`${JSON.stringify(request)}\n`)
      } catch (error) {
        this.pending.delete(id)
        signal?.removeEventListener('abort', onAbort)
        reject(new KiroCliError('could not write to Kiro ACP process', error))
      }
    })
  }

  private notify(method: string, params: Record<string, unknown>): void {
    if (this.exited) return
    try {
      this.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
    } catch {
      // The request failure path will surface the process error if it is still relevant.
    }
  }

  private receive(line: string): void {
    if (line.trim().length === 0) return
    let message: JsonRpcResponse
    try {
      message = JSON.parse(line) as JsonRpcResponse
    } catch {
      this.failAll(new KiroCliError(`Kiro ACP emitted malformed JSON: ${line.slice(0, 160)}`))
      return
    }
    if (message.method !== undefined) {
      if (message.id !== undefined) {
        void this.handleClientRequest(message.id, message.method, message.params ?? {})
        return
      }
      this.receiveNotification(message.method, message.params)
      return
    }
    if (typeof message.id === 'number') {
      const deferred = this.pending.get(message.id)
      if (deferred === undefined) return
      this.pending.delete(message.id)
      deferred.removeAbort()
      if (message.error !== undefined) {
        deferred.reject(new AcpRpcError(message.error.message ?? 'Kiro ACP request failed', message.error.code, message.error.data))
      } else {
        deferred.resolve(message.result)
      }
      return
    }
  }

  private receiveNotification(method: string, params: Record<string, unknown> | undefined): void {
    if (method !== 'session/update' && method !== 'session/notification') return
    if (params === undefined || typeof params.sessionId !== 'string') return
    const queue = this.prompts.get(params.sessionId)
    if (queue === undefined) return
    const text = promptTextFromUpdate(params)
    if (text !== undefined) queue.push(text)
    // Kiro reports ToolCall and ToolCallUpdate as status notifications. Actual
    // DSH-mediated file or terminal work arrives as an ACP client request and
    // is handled separately in receive() before this notification path.
  }

  private async handleClientRequest(id: JsonRpcId, method: string, params: Record<string, unknown>): Promise<void> {
    try {
      const handlers = this.options.handlers
      if (method === 'fs/read_text_file') {
        if (handlers?.readTextFile === undefined) return this.replyUnsupported(id)
        const request = readTextFileRequest(params)
        const content = await handlers.readTextFile(request, this.promptSignals.get(request.sessionId))
        this.replyResult(id, { content })
        return
      }
      if (method === 'fs/write_text_file') {
        if (handlers?.writeTextFile === undefined) return this.replyUnsupported(id)
        const request = writeTextFileRequest(params)
        await handlers.writeTextFile(request, this.promptSignals.get(request.sessionId))
        this.replyResult(id, {})
        return
      }
      if (method === 'terminal/create') {
        if (handlers?.createTerminal === undefined) return this.replyUnsupported(id)
        const request = createTerminalRequest(params)
        const terminal = await handlers.createTerminal(request, this.promptSignals.get(request.sessionId))
        const terminalId = `dsh-terminal-${this.nextTerminalId++}`
        this.terminals.set(terminalId, terminal)
        this.replyResult(id, { terminalId })
        return
      }
      if (method === 'terminal/output') {
        const terminal = this.terminal(params)
        this.replyResult(id, {
          output: terminal.output,
          truncated: terminal.truncated,
          ...(terminal.exitCode === null && terminal.signal === null ? {} : { exitStatus: terminalExitStatus(terminal) }),
        })
        return
      }
      if (method === 'terminal/wait_for_exit') {
        this.replyResult(id, { exitStatus: terminalExitStatus(this.terminal(params)) })
        return
      }
      if (method === 'terminal/kill') {
        this.terminal(params)
        this.replyResult(id, {})
        return
      }
      if (method === 'terminal/release') {
        this.terminals.delete(requiredString(params, 'terminalId'))
        this.replyResult(id, {})
        return
      }
      if (method === 'session/request_permission') {
        this.replyError(id, -32601, 'Kiro permission requests must use DSH-mediated file or terminal capabilities')
        return
      }
      this.replyUnsupported(id)
    } catch (error) {
      this.replyError(id, -32000, error instanceof Error ? error.message : String(error))
    }
  }

  private terminal(params: Record<string, unknown>): KiroAcpTerminal {
    const terminalId = requiredString(params, 'terminalId')
    const terminal = this.terminals.get(terminalId)
    if (terminal === undefined) throw new KiroCliError(`unknown ACP terminal ${terminalId}`)
    return terminal
  }

  private replyResult(id: JsonRpcId, result: unknown): void {
    try {
      this.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`)
    } catch {
      // The child-process error path owns the user-facing diagnostic.
    }
  }

  private replyUnsupported(id: JsonRpcId): void {
    this.replyError(id, -32601, 'dsh-plugin-kiro does not expose this ACP client capability')
  }

  private replyError(id: JsonRpcId, code: number, message: string): void {
    try {
      this.process.stdin.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code, message },
      })}\n`)
    } catch {
      // The child-process error path owns the user-facing diagnostic.
    }
  }

  private failAll(error: unknown): void {
    for (const deferred of this.pending.values()) {
      deferred.removeAbort()
      deferred.reject(error)
    }
    this.pending.clear()
    for (const queue of this.prompts.values()) queue.fail(error)
    this.prompts.clear()
  }
}
