import { resolve } from 'node:path'
import { EMPTY_RESPONSE_CODE, LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { AcpRpcError, KiroAcpClient, KiroCliError } from './acp.js'
import { isKiroAuthenticated, kiroEnvironment, listKiroModels } from './cli.js'
import { KIRO_REASONING_EFFORTS } from './effort.js'
import { toKiroContinuationPrompt, toKiroConversation, toKiroPrompt } from './messages.js'
import type { KiroCliOptions } from './cli.js'
import type { KiroAcpClientHandlers } from './acp.js'
import type { KiroReasoningEffort } from './effort.js'
import type { KiroConversation } from './messages.js'
import type { KiroModel } from './models.js'

const DEFAULT_CONTEXT_WINDOW = 128_000
const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000
const SESSION_CACHE_TTL_MS = 30 * 60 * 1_000
const SESSION_CACHE_LIMIT = 12

/** A static catalog entry for environments where discovery is intentionally disabled. */
export interface KiroModelEntry {
  id: string
  name?: string
  description?: string
}

/** Live Kiro ACP settings consumed by {@link KiroAdapter}. */
export interface KiroAdapterConfig {
  command: string
  /** Optional fixed ACP directory. Without it, each DSH session supplies its own cwd. */
  cwd?: string
  apiKeyEnv: string
  models: readonly KiroModelEntry[]
  defaultEffort?: KiroReasoningEffort
}

/** Constructor dependencies for {@link KiroAdapter}. */
export interface KiroAdapterOptions extends KiroAdapterConfig {
  onWarn?: (message: string) => void
  resolveSessionCwd?: (sessionId: GenerateOptions['sessionId']) => string | undefined
  resolveToolHandlers?: (sessionId: GenerateOptions['sessionId']) => KiroAcpClientHandlers | undefined
}

interface KiroSession {
  client: KiroAcpClient
  acpSessionId: string
  cwd: string
  effort?: string
  model: string
  conversation: KiroConversation
  response: string
  lastUsedAt: number
}

function modelInfo(provider: string, model: KiroModel): LlmModelInfo {
  return {
    provider,
    id: model.id,
    name: model.name,
    ...(model.description === undefined ? {} : { description: model.description }),
    inputModalities: ['text'],
  }
}

function asKiroModel(entry: KiroModelEntry): KiroModel {
  return {
    id: entry.id,
    name: entry.name ?? entry.id,
    ...(entry.description === undefined ? {} : { description: entry.description }),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Kiro ACP adapter registered under the `kiro` DSH provider route. */
export class KiroAdapter extends LlmAdapter {
  private command!: KiroCliOptions
  private configuredCwd: string | undefined
  private configuredModels: KiroModel[] = []
  private defaultEffort: KiroReasoningEffort | undefined
  private catalogSignature = ''
  private runtimeSignature = ''
  private discovered = new Map<string, KiroModel>()
  private modelCache: { expiresAt: number; models: readonly KiroModel[] } | undefined
  private modelDiscovery: Promise<readonly KiroModel[]> | undefined
  private readonly sessions = new Map<string, KiroSession>()

  constructor(private readonly options: KiroAdapterOptions) {
    super()
    this.setConfig(options)
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'Kiro (ACP)' }
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await this.catalog()
    return models.map(model => modelInfo(provider, model))
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const known = this.discovered.get(model) ?? this.configuredModels.find(entry => entry.id === model)
    return {
      ...modelInfo(provider, known ?? { id: model, name: model }),
      context: { contextWindow: DEFAULT_CONTEXT_WINDOW },
      reasoning: {
        efforts: KIRO_REASONING_EFFORTS.map(effort => ({
          ...effort,
          id: ReasoningEffortId(effort.id),
        })),
        ...(this.defaultEffort === undefined ? {} : { defaultEffort: ReasoningEffortId(this.defaultEffort) }),
      },
    }
  }

  /** Apply live ACP settings and invalidate the catalog only when it can change. */
  setConfig(config: KiroAdapterConfig): void {
    const configuredCwd = config.cwd === undefined || config.cwd.trim().length === 0
      ? undefined
      : resolve(config.cwd)
    const command = {
      command: config.command,
      cwd: configuredCwd ?? process.cwd(),
      apiKeyEnv: config.apiKeyEnv,
    }
    const configuredModels = config.models.map(asKiroModel)
    const catalogSignature = JSON.stringify({ command, configuredModels })
    const runtimeSignature = JSON.stringify({ command, defaultEffort: config.defaultEffort })
    const catalogChanged = catalogSignature !== this.catalogSignature
    const runtimeChanged = this.runtimeSignature.length > 0 && runtimeSignature !== this.runtimeSignature
    if (runtimeChanged) this.close()
    this.command = command
    this.configuredCwd = configuredCwd
    this.configuredModels = configuredModels
    this.defaultEffort = config.defaultEffort
    this.runtimeSignature = runtimeSignature
    if (!catalogChanged) return
    this.catalogSignature = catalogSignature
    this.discovered = new Map()
    this.modelCache = undefined
    this.modelDiscovery = undefined
  }

  /** Stop every retained ACP process. Called when the plugin reloads or its runtime changes. */
  close(): void {
    for (const session of this.sessions.values()) session.client.close()
    this.sessions.clear()
  }

  /** Forget the current user's model list after a completed Kiro sign-in. */
  invalidateModelCatalog(): void {
    this.discovered = new Map()
    this.modelCache = undefined
    this.modelDiscovery = undefined
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const command = this.command
    const cwd = this.configuredCwd ?? this.options.resolveSessionCwd?.(options.sessionId) ?? command.cwd
    const requestCommand = cwd === command.cwd ? command : { ...command, cwd }
    const effort = options.reasoningEffort === undefined ? this.defaultEffort : String(options.reasoningEffort)
    const conversation = toKiroConversation(options)
    const sessionKey = options.sessionId === undefined ? undefined : String(options.sessionId)
    this.pruneSessions()

    let retained = sessionKey === undefined ? undefined : this.sessions.get(sessionKey)
    if (retained !== undefined && (
      !retained.client.isRunning || retained.cwd !== cwd || retained.effort !== effort
    )) {
      this.dropSession(sessionKey!)
      retained = undefined
    }

    let prompt: string | undefined
    if (retained !== undefined) {
      prompt = toKiroContinuationPrompt(conversation, retained.conversation, retained.response)
      if (prompt === undefined) {
        this.dropSession(sessionKey!)
        retained = undefined
      }
    }

    let client: KiroAcpClient | undefined
    let acpSessionId: string | undefined
    let completed = false
    try {
      if (retained === undefined) {
        if (!await isKiroAuthenticated(requestCommand, options.signal)) {
          throw new LlmError(
            'Kiro is not authenticated. Run `kiro-cli login`, or set the configured API-key environment variable after your Kiro administrator enables API keys.',
            'MISSING_CREDENTIAL',
          )
        }
        const handlers = this.options.resolveToolHandlers?.(options.sessionId)
        client = new KiroAcpClient({
          command: requestCommand.command,
          args: effort === undefined ? ['acp'] : ['acp', '--effort', effort],
          cwd,
          env: kiroEnvironment(requestCommand.apiKeyEnv),
          ...(handlers === undefined ? {} : { handlers }),
        })
        prompt = toKiroPrompt(options)
        await client.initialize(options.signal)
        acpSessionId = await client.newSession(cwd, options.signal)
        await client.setModel(acpSessionId, options.model, options.signal)
        if (sessionKey !== undefined) {
          retained = {
            client,
            acpSessionId,
            cwd,
            ...(effort === undefined ? {} : { effort }),
            model: options.model,
            conversation,
            response: '',
            lastUsedAt: Date.now(),
          }
          this.sessions.set(sessionKey, retained)
        }
      } else {
        client = retained.client
        acpSessionId = retained.acpSessionId
        if (retained.model !== options.model) await client.setModel(acpSessionId, options.model, options.signal)
      }
      if (client === undefined || acpSessionId === undefined || prompt === undefined) {
        throw new KiroCliError('Kiro ACP session was not initialized')
      }
      let text = ''
      let started = false
      for await (const chunk of client.prompt(acpSessionId, prompt, options.signal)) {
        if (chunk.length === 0) continue
        if (!started) {
          started = true
          yield { type: 'block-start', index: 0, blockType: 'text' }
        }
        text += chunk
        yield { type: 'text-delta', index: 0, text: chunk }
      }
      if (!started) {
        throw new LlmError('Kiro completed the request without text output', EMPTY_RESPONSE_CODE)
      }
      if (retained !== undefined) {
        retained.model = options.model
        retained.conversation = conversation
        retained.response = text
        retained.lastUsedAt = Date.now()
      }
      completed = true
      this.pruneSessions()
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } catch (error) {
      if (retained !== undefined && sessionKey !== undefined && this.sessions.get(sessionKey) === retained) {
        this.dropSession(sessionKey)
      } else {
        client?.close()
      }
      throw this.toLlmError(error, options.signal)
    } finally {
      if (!completed && retained !== undefined && sessionKey !== undefined && this.sessions.get(sessionKey) === retained) {
        this.dropSession(sessionKey)
      }
      if (retained === undefined) client?.close()
    }
  }

  private pruneSessions(now = Date.now()): void {
    for (const [key, session] of this.sessions) {
      if (!session.client.isRunning || now - session.lastUsedAt >= SESSION_CACHE_TTL_MS) this.dropSession(key)
    }
    while (this.sessions.size > SESSION_CACHE_LIMIT) {
      let oldest: [string, KiroSession] | undefined
      for (const entry of this.sessions) {
        if (oldest === undefined || entry[1].lastUsedAt < oldest[1].lastUsedAt) oldest = entry
      }
      if (oldest === undefined) return
      this.dropSession(oldest[0])
    }
  }

  private dropSession(key: string): void {
    const session = this.sessions.get(key)
    if (session === undefined) return
    this.sessions.delete(key)
    session.client.close()
  }

  private remember(models: readonly KiroModel[]): void {
    this.discovered = new Map(models.map(model => [model.id, model]))
  }

  private async catalog(): Promise<readonly KiroModel[]> {
    const cached = this.modelCache
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.models
    const pending = this.modelDiscovery
    if (pending !== undefined) return pending
    const discovery = this.discoverModels()
    this.modelDiscovery = discovery
    try {
      const models = await discovery
      if (models.length > 0 && this.modelDiscovery === discovery) {
        this.modelCache = { models, expiresAt: Date.now() + MODEL_CACHE_TTL_MS }
      }
      return models
    } finally {
      if (this.modelDiscovery === discovery) this.modelDiscovery = undefined
    }
  }

  private async discoverModels(): Promise<readonly KiroModel[]> {
    const command = this.command
    const configuredModels = this.configuredModels
    const signature = this.catalogSignature
    try {
      if (!await isKiroAuthenticated(command)) return []
      const models = await listKiroModels(command)
      if (this.catalogSignature === signature) this.remember(models)
      return models
    } catch (error) {
      if (configuredModels.length === 0) {
        this.options.onWarn?.(`Kiro model discovery failed; provider is hidden (${errorMessage(error)})`)
        return []
      }
      this.options.onWarn?.(`Kiro model discovery failed; using configured models (${errorMessage(error)})`)
      return configuredModels
    }
  }

  private toLlmError(error: unknown, signal: AbortSignal | undefined): LlmError {
    if (error instanceof LlmError) return error
    if (signal?.aborted === true || (error instanceof Error && /aborted/i.test(error.message))) {
      return new LlmError('Kiro request was aborted', 'ABORTED', { cause: error })
    }
    if (error instanceof AcpRpcError && /auth|credential|login|identity/i.test(error.message)) {
      return new LlmError(`Kiro authentication failed: ${error.message}`, 'AUTH', { cause: error })
    }
    if (error instanceof KiroCliError && /could not start Kiro CLI/i.test(error.message)) {
      return new LlmError(`Kiro CLI is unavailable: ${error.message}`, 'MISSING_DEPENDENCY', { cause: error })
    }
    return new LlmError(`Kiro ACP request failed: ${errorMessage(error)}`, 'TRANSPORT', { cause: error })
  }
}
