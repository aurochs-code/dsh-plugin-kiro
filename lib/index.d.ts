/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { KiroModelEntry } from './adapter.js';
export declare const name = "dsh-plugin-kiro";
export declare const inject: string[];
/** Plugin configuration. Secrets are always supplied through the environment, never this object. */
export interface Config {
    /** Absolute path or executable name for the Kiro CLI. */
    command?: string;
    /** Directory Kiro receives when it creates each ACP session. */
    cwd?: string;
    /** Optional environment variable holding a Kiro API key; defaults to Kiro's documented name. */
    apiKeyEnv?: string;
    /** Static fallback model catalog when CLI discovery is unavailable. */
    models?: KiroModelEntry[];
}
export declare const Config: z<Config>;
/** Register the Kiro adapter. Authentication remains in the local Kiro CLI or environment. */
export declare function apply(ctx: Context, config: Config): void;
export { KiroAdapter } from './adapter.js';
export { KiroAcpClient } from './acp.js';
export { parseKiroModels } from './models.js';
