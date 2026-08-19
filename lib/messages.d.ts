import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
/**
 * Serialize a DSH conversation into one ACP text prompt. ACP carries one text
 * field rather than native system/user/assistant roles, so JSON preserves the
 * message boundary and keeps role-like text inside message content as data.
 */
export declare function toKiroPrompt(options: Pick<GenerateOptions, 'messages' | 'system'>): string;
