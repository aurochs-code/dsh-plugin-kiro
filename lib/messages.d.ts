import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm';
export interface KiroConversationMessage {
    role: Message['role'];
    source: Message['source']['kind'];
    content: string;
}
/** Lossless text-only view of the DSH conversation that Kiro receives. */
export interface KiroConversation {
    system?: string;
    messages: readonly KiroConversationMessage[];
}
/** Convert DSH messages to the exact structured data held by one Kiro ACP session. */
export declare function toKiroConversation(options: Pick<GenerateOptions, 'messages' | 'system'>): KiroConversation;
/**
 * Serialize a DSH conversation into one ACP text prompt. ACP carries one text
 * field rather than native system/user/assistant roles, so JSON preserves the
 * message boundary and keeps role-like text inside message content as data.
 */
export declare function toKiroPrompt(options: Pick<GenerateOptions, 'messages' | 'system'>): string;
/**
 * Build an incremental prompt for a still-live Kiro session. A changed system
 * prompt or divergent history returns `undefined` so the caller can start a
 * fresh ACP session with the complete conversation instead of guessing.
 */
export declare function toKiroContinuationPrompt(conversation: KiroConversation, previous: KiroConversation, previousResponse: string): string | undefined;
