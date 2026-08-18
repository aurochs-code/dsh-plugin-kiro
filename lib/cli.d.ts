import type { KiroModel } from './models.js';
/** Process-level configuration shared by Kiro CLI probes and ACP sessions. */
export interface KiroCliOptions {
    command: string;
    cwd: string;
    /** Environment variable where DSH receives an optional Kiro API key. */
    apiKeyEnv: string;
}
export interface KiroCommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
}
/** Map a custom secret variable to Kiro's documented `KIRO_API_KEY` input without persisting it. */
export declare function kiroEnvironment(apiKeyEnv: string): NodeJS.ProcessEnv;
/** Run one bounded Kiro CLI command without invoking a shell. */
export declare function runKiroCommand(options: KiroCliOptions, args: readonly string[], signal?: AbortSignal): Promise<KiroCommandResult>;
/** A non-interactive credential check. A nonzero result simply means the provider stays hidden. */
export declare function isKiroAuthenticated(options: KiroCliOptions, signal?: AbortSignal): Promise<boolean>;
/** Fetch the model catalog exposed to the current Kiro identity and enterprise policy. */
export declare function listKiroModels(options: KiroCliOptions, signal?: AbortSignal): Promise<KiroModel[]>;
