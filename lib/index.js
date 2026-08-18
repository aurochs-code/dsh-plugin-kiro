/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */
import z from '@deepseek-ai/schemastery';
import { KiroAdapter } from './adapter.js';
export const name = 'dsh-plugin-kiro';
export const inject = ['llm'];
const modelEntrySchema = z.object({
    id: z.string().required(),
    name: z.string(),
    description: z.string(),
});
export const Config = z.object({
    command: z.string().default('kiro-cli'),
    cwd: z.string().default(process.cwd()),
    apiKeyEnv: z.string().default('KIRO_API_KEY'),
    models: z.array(modelEntrySchema),
});
/** Register the Kiro adapter. Authentication remains in the local Kiro CLI or environment. */
export function apply(ctx, config) {
    const command = config.command ?? 'kiro-cli';
    const cwd = config.cwd ?? process.cwd();
    const apiKeyEnv = config.apiKeyEnv ?? 'KIRO_API_KEY';
    const models = config.models ?? [];
    ctx.llm.registerAdapter(['kiro'], new KiroAdapter({
        command,
        cwd,
        apiKeyEnv,
        models,
        onWarn: message => ctx.logger.warn(`${name}: ${message}`),
    }));
}
export { KiroAdapter } from './adapter.js';
export { KiroAcpClient } from './acp.js';
export { parseKiroModels } from './models.js';
