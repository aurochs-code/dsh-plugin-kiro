import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
/**
 * Serialize a DSH conversation into one ACP text prompt. A new ACP session is
 * created per request, so all history must travel with the current request.
 */
export declare function toKiroPrompt(options: Pick<GenerateOptions, 'messages' | 'system'>): string;
