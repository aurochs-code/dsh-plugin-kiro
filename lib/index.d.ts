/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { KiroAuthenticationRpcResult } from './auth.js';
import type { KiroModelEntry } from './adapter.js';
import type { KiroReasoningEffort } from './effort.js';
export declare const name = "dsh-plugin-kiro";
export declare const inject: string[];
type KiroAuthenticationRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<KiroAuthenticationRpcResult>;
interface KiroHostContext extends Context {
    connection: {
        rpc: {
            handle(channel: string, handler: KiroAuthenticationRpcHandler, options: {
                authority: 'loopback';
            }): () => Promise<void>;
        };
    };
}
/** Plugin configuration. Secrets are always supplied through the environment, never this object. */
export interface Config {
    /** Absolute path or executable name for the Kiro CLI. */
    command?: string;
    /** Optional fixed directory Kiro receives when it creates each ACP session. */
    cwd?: string;
    /** Optional environment variable holding a Kiro API key; defaults to Kiro's documented name. */
    apiKeyEnv?: string;
    /** Static fallback model catalog when CLI discovery is unavailable. */
    models?: KiroModelEntry[];
    /** Applied only when a conversation does not choose a reasoning effort. */
    defaultEffort?: KiroReasoningEffort;
}
export declare const Config: z<Config>;
/** Register the Kiro adapter and its loopback-only Kiro CLI authentication bridge. */
export declare function apply(ctx: KiroHostContext, config: Config): void;
export { KiroAdapter } from './adapter.js';
export { KiroAcpClient } from './acp.js';
export { parseKiroModels } from './models.js';
