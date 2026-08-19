/**
 * dsh-plugin-kiro: expose a locally authenticated Kiro CLI as DSH's `kiro`
 * LLM provider. The plugin uses Kiro's documented Agent Client Protocol (ACP)
 * instead of copying enterprise SSO credentials or relying on private HTTP APIs.
 */
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from '@deepseek-ai/schemastery';
import { KiroAdapter } from './adapter.js';
import { createKiroAuthenticationRpcHandler, KiroAuthenticationService } from './auth.js';
import { createDshToolHandlers } from './dsh-bridge.js';
export const name = 'dsh-plugin-kiro';
export const inject = ['llm', 'sessions', 'agents', 'tools', 'connection'];
const settingsNamespaceId = settingsNamespace('kiro');
const modelEntrySchema = z.object({
    id: z.string().required(),
    name: z.string(),
    description: z.string(),
});
const effortSchema = z.union(['low', 'medium', 'high', 'xhigh', 'max']);
export const Config = z.object({
    command: z.string().default('kiro-cli'),
    cwd: z.string(),
    apiKeyEnv: z.string().default('KIRO_API_KEY'),
    models: z.array(modelEntrySchema),
    defaultEffort: effortSchema,
});
function configuredCwd(config) {
    const cwd = config.cwd?.trim();
    return cwd === undefined || cwd.length === 0 ? undefined : cwd;
}
function adapterConfig(config) {
    const cwd = configuredCwd(config);
    return {
        command: config.command ?? 'kiro-cli',
        apiKeyEnv: config.apiKeyEnv ?? 'KIRO_API_KEY',
        models: config.models ?? [],
        ...(cwd === undefined ? {} : { cwd }),
        ...(config.defaultEffort === undefined ? {} : { defaultEffort: config.defaultEffort }),
    };
}
function authenticationCommand(config) {
    return {
        command: config.command ?? 'kiro-cli',
        cwd: configuredCwd(config) ?? process.cwd(),
        apiKeyEnv: config.apiKeyEnv ?? 'KIRO_API_KEY',
    };
}
/** Register the Kiro adapter and its loopback-only Kiro CLI authentication bridge. */
export function apply(ctx, config) {
    const cwd = configuredCwd(config);
    const base = {
        command: config.command ?? 'kiro-cli',
        apiKeyEnv: config.apiKeyEnv ?? 'KIRO_API_KEY',
        models: config.models ?? [],
        ...(cwd === undefined ? {} : { cwd }),
        ...(config.defaultEffort === undefined ? {} : { defaultEffort: config.defaultEffort }),
    };
    let source = () => base;
    const adapter = new KiroAdapter({
        ...adapterConfig(base),
        onWarn: message => ctx.logger.warn(`${name}: ${message}`),
        resolveSessionCwd: sessionId => sessionId === undefined ? undefined : ctx.sessions.get(sessionId)?.header.cwd,
        resolveToolHandlers: sessionId => createDshToolHandlers(ctx, sessionId),
    });
    ctx.effect(() => () => adapter.close(), 'Kiro ACP sessions');
    const registration = ctx.llm.registerAdapter(['kiro'], adapter);
    const authentication = new KiroAuthenticationService({
        resolveCommand: () => authenticationCommand(source()),
        onAuthenticated: () => {
            adapter.invalidateModelCatalog();
            registration.replace(['kiro']);
        },
    });
    ctx.effect(() => () => authentication.close(), 'Kiro authentication');
    ctx.effect(() => ctx.connection.rpc.handle('/kiro-auth', createKiroAuthenticationRpcHandler(authentication), { authority: 'loopback' }), 'Kiro authentication RPC');
    installSettingsSection(ctx, settingsNamespaceId, Config, base, {
        setSource(next) {
            source = next;
        },
        onChange() {
            adapter.setConfig(adapterConfig(source()));
            // Let model selectors re-read the catalog after a CLI/workspace setting changes.
            registration.replace(['kiro']);
        },
    });
}
export { KiroAdapter } from './adapter.js';
export { KiroAcpClient } from './acp.js';
export { parseKiroModels } from './models.js';
