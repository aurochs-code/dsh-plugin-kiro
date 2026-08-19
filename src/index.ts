/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { KiroAdapter } from './adapter.js'
import { createDshToolHandlers } from './dsh-bridge.js'
import type { KiroAdapterConfig, KiroModelEntry } from './adapter.js'
import type { KiroReasoningEffort } from './effort.js'

export const name = 'dsh-plugin-kiro'
export const inject = ['llm', 'sessions', 'agents', 'tools']
const settingsNamespaceId = settingsNamespace('kiro')

/** Plugin configuration. Secrets are always supplied through the environment, never this object. */
export interface Config {
  /** Absolute path or executable name for the Kiro CLI. */
  command?: string
  /** Optional fixed directory Kiro receives when it creates each ACP session. */
  cwd?: string
  /** Optional environment variable holding a Kiro API key; defaults to Kiro's documented name. */
  apiKeyEnv?: string
  /** Static fallback model catalog when CLI discovery is unavailable. */
  models?: KiroModelEntry[]
  /** Applied only when a conversation does not choose a reasoning effort. */
  defaultEffort?: KiroReasoningEffort
}

const modelEntrySchema: z<KiroModelEntry> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
})

const effortSchema: z<KiroReasoningEffort> = z.union(['low', 'medium', 'high', 'xhigh', 'max'])

export const Config: z<Config> = z.object({
  command: z.string().default('kiro-cli'),
  cwd: z.string(),
  apiKeyEnv: z.string().default('KIRO_API_KEY'),
  models: z.array(modelEntrySchema),
  defaultEffort: effortSchema,
})

function configuredCwd(config: Config): string | undefined {
  const cwd = config.cwd?.trim()
  return cwd === undefined || cwd.length === 0 ? undefined : cwd
}

function adapterConfig(config: Config): KiroAdapterConfig {
  const cwd = configuredCwd(config)
  return {
    command: config.command ?? 'kiro-cli',
    apiKeyEnv: config.apiKeyEnv ?? 'KIRO_API_KEY',
    models: config.models ?? [],
    ...(cwd === undefined ? {} : { cwd }),
    ...(config.defaultEffort === undefined ? {} : { defaultEffort: config.defaultEffort }),
  }
}

/** Register the Kiro adapter. Authentication remains in the local Kiro CLI or environment. */
export function apply(ctx: Context, config: Config): void {
  const cwd = configuredCwd(config)
  const base: Config = {
    command: config.command ?? 'kiro-cli',
    apiKeyEnv: config.apiKeyEnv ?? 'KIRO_API_KEY',
    models: config.models ?? [],
    ...(cwd === undefined ? {} : { cwd }),
    ...(config.defaultEffort === undefined ? {} : { defaultEffort: config.defaultEffort }),
  }
  let source = (): Config => base
  const adapter = new KiroAdapter({
    ...adapterConfig(base),
    onWarn: message => ctx.logger.warn(`${name}: ${message}`),
    resolveSessionCwd: sessionId => sessionId === undefined ? undefined : ctx.sessions.get(sessionId)?.header.cwd,
    resolveToolHandlers: sessionId => createDshToolHandlers(ctx, sessionId),
  })
  ctx.effect(() => () => adapter.close(), 'Kiro ACP sessions')
  const registration = ctx.llm.registerAdapter(['kiro'], adapter)
  installSettingsSection(ctx, settingsNamespaceId, Config, base, {
    setSource(next) {
      source = next
    },
    onChange() {
      adapter.setConfig(adapterConfig(source()))
      // Let model selectors re-read the catalog after a CLI/workspace setting changes.
      registration.replace(['kiro'])
    },
  })
}

export { KiroAdapter } from './adapter.js'
export { KiroAcpClient } from './acp.js'
export { parseKiroModels } from './models.js'
