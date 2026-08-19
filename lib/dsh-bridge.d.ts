import type { Context } from '@deepseek-ai/cordis';
import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { KiroAcpClientHandlers } from './acp.js';
/**
 * Expose standard ACP file and terminal callbacks only through DSH's own tool
 * runtime. The registry applies the same guards, approval prompts, sandboxing,
 * and audit records as a tool call made by the DSH agent itself.
 */
export declare function createDshToolHandlers(ctx: Context, sessionId: GenerateOptions['sessionId']): KiroAcpClientHandlers | undefined;
