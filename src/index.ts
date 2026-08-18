/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { KiroAdapter } from './adapter.js'
import type { KiroModelEntry } from './adapter.js'

export const name = 'dsh-plugin-kiro'
export const inject = ['llm']

/** Plugin configuration. Secrets are always supplied through the environment, never this object. */
export interface Config {
  /** Absolute path or executable name for the Kiro CLI. */
  command?: string
  /** Directory Kiro receives when it creates each ACP session. */
  cwd?: string
  /** Optional environment variable holding a Kiro API key; defaults to Kiro's documented name. */
  apiKeyEnv?: string
  /** Static fallback model catalog when CLI discovery is unavailable. */
  models?: KiroModelEntry[]
}

const modelEntrySchema: z<KiroModelEntry> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
})

export const Config: z<Config> = z.object({
  command: z.string().default('kiro-cli'),
  cwd: z.string().default(process.cwd()),
  apiKeyEnv: z.string().default('KIRO_API_KEY'),
  models: z.array(modelEntrySchema),
})

/** Register the Kiro adapter. Authentication remains in the local Kiro CLI or environment. */
export function apply(ctx: Context, config: Config): void {
  const command = config.command ?? 'kiro-cli'
  const cwd = config.cwd ?? process.cwd()
  const apiKeyEnv = config.apiKeyEnv ?? 'KIRO_API_KEY'
  const models = config.models ?? []
  ctx.llm.registerAdapter(['kiro'], new KiroAdapter({
    command,
    cwd,
    apiKeyEnv,
    models,
    onWarn: message => ctx.logger.warn(`${name}: ${message}`),
  }))
}

export { KiroAdapter } from './adapter.js'
export { KiroAcpClient } from './acp.js'
export { parseKiroModels } from './models.js'
