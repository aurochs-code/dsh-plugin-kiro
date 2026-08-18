import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { KiroCliOptions } from './cli.js';
import type { KiroReasoningEffort } from './effort.js';
/** A static catalog entry for environments where discovery is intentionally disabled. */
export interface KiroModelEntry {
    id: string;
    name?: string;
    description?: string;
}
/** Live Kiro ACP settings consumed by {@link KiroAdapter}. */
export interface KiroAdapterConfig extends KiroCliOptions {
    models: readonly KiroModelEntry[];
    defaultEffort?: KiroReasoningEffort;
}
/** Constructor dependencies for {@link KiroAdapter}. */
export interface KiroAdapterOptions extends KiroAdapterConfig {
    onWarn?: (message: string) => void;
}
/** Kiro ACP adapter registered under the `kiro` DSH provider route. */
export declare class KiroAdapter extends LlmAdapter {
    private readonly options;
    private command;
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
