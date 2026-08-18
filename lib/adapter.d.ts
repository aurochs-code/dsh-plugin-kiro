import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { KiroCliOptions } from './cli.js';
/** A static catalog entry for environments where discovery is intentionally disabled. */
export interface KiroModelEntry {
    id: string;
    name?: string;
    description?: string;
}
/** Constructor dependencies for {@link KiroAdapter}. */
export interface KiroAdapterOptions extends KiroCliOptions {
    models: readonly KiroModelEntry[];
    onWarn?: (message: string) => void;
}
/** Kiro ACP adapter registered under the `kiro` DSH provider route. */
export declare class KiroAdapter extends LlmAdapter {
    private readonly options;
    private readonly command;
    private readonly configuredModels;
    private discovered;
    constructor(options: KiroAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private remember;
    private toLlmError;
}
