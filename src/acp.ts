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

interface JsonRpcResponse {
  jsonrpc?: string
  id?: number
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
}

/**
 * Minimal ACP client for Kiro CLI. It intentionally advertises no file-system
 * or terminal capabilities: DSH owns tool execution, while this adapter only
 * accepts text model output.
 */
export class KiroAcpClient {
  private readonly pending = new Map<number, Deferred<unknown>>()
  private readonly prompts = new Map<string, AsyncQueue<string>>()
  private readonly process: ChildProcessWithoutNullStreams
  private nextId = 1
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

  async initialize(signal?: AbortSignal): Promise<void> {
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'dsh-plugin-kiro', version: '0.2.3' },
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
      if (!finished) this.notify('session/cancel', { sessionId })
    }
  }

  close(): void {
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
    if (message.method !== 'session/update' && message.method !== 'session/notification') {
      if (message.id !== undefined) this.replyUnsupported(message.id)
      return
    }
    const params = message.params
    if (params === undefined || typeof params.sessionId !== 'string') return
    const queue = this.prompts.get(params.sessionId)
    if (queue === undefined) return
    const text = promptTextFromUpdate(params)
    if (text !== undefined) queue.push(text)
    // Kiro reports ToolCall and ToolCallUpdate as ACP status notifications.
    // They describe work performed by the Kiro agent, not a request for this
    // client to execute a DeepSeek Harness tool, so final text may still follow.
  }

  private replyUnsupported(id: number): void {
    try {
      this.process.stdin.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'dsh-plugin-kiro exposes no client-side tools' },
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
