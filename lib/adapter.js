import { resolve } from 'node:path';
import { EMPTY_RESPONSE_CODE, LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import { AcpRpcError, KiroAcpClient, KiroCliError } from './acp.js';
import { isKiroAuthenticated, kiroEnvironment, listKiroModels } from './cli.js';
import { toKiroPrompt } from './messages.js';
const DEFAULT_CONTEXT_WINDOW = 128_000;
function modelInfo(provider, model) {
    return {
        provider,
        id: model.id,
        name: model.name,
        ...(model.description === undefined ? {} : { description: model.description }),
        inputModalities: ['text'],
    };
}
function asKiroModel(entry) {
    return {
        id: entry.id,
        name: entry.name ?? entry.id,
        ...(entry.description === undefined ? {} : { description: entry.description }),
    };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Kiro ACP adapter registered under the `kiro` DSH provider route. */
export class KiroAdapter extends LlmAdapter {
    options;
    command;
    configuredModels;
    discovered = new Map();
    constructor(options) {
        super();
        this.options = options;
        this.command = {
            command: options.command,
            cwd: resolve(options.cwd),
            apiKeyEnv: options.apiKeyEnv,
        };
        this.configuredModels = options.models.map(asKiroModel);
    }
    providerInfo(provider) {
        return { id: provider, name: 'Kiro (ACP)' };
    }
    async listModels(provider) {
        try {
            if (!await isKiroAuthenticated(this.command))
                return [];
            const models = await listKiroModels(this.command);
            this.remember(models);
            return models.map(model => modelInfo(provider, model));
        }
        catch (error) {
            if (this.configuredModels.length === 0) {
                this.options.onWarn?.(`Kiro model discovery failed; provider is hidden (${errorMessage(error)})`);
                return [];
            }
            this.options.onWarn?.(`Kiro model discovery failed; using configured models (${errorMessage(error)})`);
            return this.configuredModels.map(model => modelInfo(provider, model));
        }
    }
    async resolveModel(provider, model) {
        const known = this.discovered.get(model) ?? this.configuredModels.find(entry => entry.id === model);
        return {
            ...modelInfo(provider, known ?? { id: model, name: model }),
            context: { contextWindow: DEFAULT_CONTEXT_WINDOW },
        };
    }
    async *stream(options) {
        const client = new KiroAcpClient({
            command: this.command.command,
            cwd: this.command.cwd,
            env: kiroEnvironment(this.command.apiKeyEnv),
        });
        try {
            if (!await isKiroAuthenticated(this.command, options.signal)) {
                throw new LlmError('Kiro is not authenticated. Run `kiro-cli login`, or set the configured API-key environment variable after your Kiro administrator enables API keys.', 'MISSING_CREDENTIAL');
            }
            const prompt = toKiroPrompt(options);
            await client.initialize(options.signal);
            const sessionId = await client.newSession(this.command.cwd, options.signal);
            await client.setModel(sessionId, options.model, options.signal);
            let text = '';
            let started = false;
            for await (const chunk of client.prompt(sessionId, prompt, options.signal)) {
                if (chunk.length === 0)
                    continue;
                if (!started) {
                    started = true;
                    yield { type: 'block-start', index: 0, blockType: 'text' };
                }
                text += chunk;
                yield { type: 'text-delta', index: 0, text: chunk };
            }
            if (!started) {
                throw new LlmError('Kiro completed the request without text output', EMPTY_RESPONSE_CODE);
            }
            yield { type: 'block-end', index: 0, block: { type: 'text', text } };
            yield { type: 'finish', reason: { kind: 'stop' } };
        }
        catch (error) {
            throw this.toLlmError(error, options.signal);
        }
        finally {
            client.close();
        }
    }
    remember(models) {
        this.discovered = new Map(models.map(model => [model.id, model]));
    }
    toLlmError(error, signal) {
        if (error instanceof LlmError)
            return error;
        if (signal?.aborted === true || (error instanceof Error && /aborted/i.test(error.message))) {
            return new LlmError('Kiro request was aborted', 'ABORTED', { cause: error });
        }
        if (error instanceof AcpRpcError && /auth|credential|login|identity/i.test(error.message)) {
            return new LlmError(`Kiro authentication failed: ${error.message}`, 'AUTH', { cause: error });
        }
        if (error instanceof KiroCliError && /could not start Kiro CLI/i.test(error.message)) {
            return new LlmError(`Kiro CLI is unavailable: ${error.message}`, 'MISSING_DEPENDENCY', { cause: error });
        }
        return new LlmError(`Kiro ACP request failed: ${errorMessage(error)}`, 'TRANSPORT', { cause: error });
    }
}
