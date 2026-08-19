import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { KiroReasoningEffort } from './effort.js';
/** A static catalog entry for environments where discovery is intentionally disabled. */
export interface KiroModelEntry {
    id: string;
    name?: string;
    description?: string;
}
/** Live Kiro ACP settings consumed by {@link KiroAdapter}. */
export interface KiroAdapterConfig {
    command: string;
    /** Optional fixed ACP directory. Without it, each DSH session supplies its own cwd. */
    cwd?: string;
    apiKeyEnv: string;
    models: readonly KiroModelEntry[];
    defaultEffort?: KiroReasoningEffort;
}
/** Constructor dependencies for {@link KiroAdapter}. */
export interface KiroAdapterOptions extends KiroAdapterConfig {
    onWarn?: (message: string) => void;
    resolveSessionCwd?: (sessionId: GenerateOptions['sessionId']) => string | undefined;
}
/** Kiro ACP adapter registered under the `kiro` DSH provider route. */
export declare class KiroAdapter extends LlmAdapter {
    private readonly options;
    private command;
    private configuredCwd;
    private configuredModels;
    private defaultEffort;
    private catalogSignature;
    private discovered;
    private modelCache;
    private modelDiscovery;
    constructor(options: KiroAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    /** Apply live ACP settings and invalidate the catalog only when it can change. */
    setConfig(config: KiroAdapterConfig): void;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private remember;
    private catalog;
    private discoverModels;
    private toLlmError;
}
