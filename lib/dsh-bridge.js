import { CallId } from '@deepseek-ai/dsh-llm';
import { KiroCliError } from './acp.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringField(value, name) {
    const field = value[name];
    if (typeof field !== 'string')
        throw new KiroCliError(`DSH ${name} result was malformed`);
    return field;
}
function booleanField(value, name) {
    const field = value[name];
    if (typeof field !== 'boolean')
        throw new KiroCliError(`DSH ${name} result was malformed`);
    return field;
}
function nullableNumberField(value, name) {
    const field = value[name];
    if (field === null)
        return null;
    if (typeof field !== 'number')
        throw new KiroCliError(`DSH ${name} result was malformed`);
    return field;
}
function nullableStringField(value, name) {
    const field = value[name];
    if (field === null)
        return null;
    if (typeof field !== 'string')
        throw new KiroCliError(`DSH ${name} result was malformed`);
    return field;
}
function quoted(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
function terminalCommand(request) {
    return [request.command, ...(request.args ?? [])].map(quoted).join(' ');
}
function terminalValue(value) {
    if (!isRecord(value) || value.kind !== 'foreground') {
        throw new KiroCliError('DSH bash did not return a foreground terminal result');
    }
    if (!isRecord(value.stdout) || !isRecord(value.stderr)) {
        throw new KiroCliError('DSH bash result was malformed');
    }
    const stdout = stringField(value.stdout, 'text');
    const stderr = stringField(value.stderr, 'text');
    return {
        output: [stdout, stderr].filter(text => text.length > 0).join(stdout.length > 0 && stderr.length > 0 ? '\n' : ''),
        truncated: booleanField(value.stdout, 'truncated') || booleanField(value.stderr, 'truncated'),
        exitCode: nullableNumberField(value, 'exitCode'),
        signal: nullableStringField(value, 'signal'),
    };
}
function readValue(value) {
    if (!isRecord(value) || !Array.isArray(value.lines))
        throw new KiroCliError('DSH read result was malformed');
    return value.lines.map((line) => {
        if (!isRecord(line))
            throw new KiroCliError('DSH read result was malformed');
        return stringField(line, 'text');
    }).join('\n');
}
/**
 * Expose standard ACP file and terminal callbacks only through DSH's own tool
 * runtime. The registry applies the same guards, approval prompts, sandboxing,
 * and audit records as a tool call made by the DSH agent itself.
 */
export function createDshToolHandlers(ctx, sessionId) {
    if (sessionId === undefined || ctx.agents.get(sessionId) === undefined)
        return undefined;
    let callIndex = 0;
    const run = async (name, args, signal) => {
        const agent = ctx.agents.get(sessionId);
        if (agent === undefined)
            throw new KiroCliError('the DSH session is no longer available for this Kiro ACP request');
        const result = await ctx.tools.execute({
            callId: CallId(`kiro-acp-${String(sessionId)}-${++callIndex}`),
            name,
            arguments: args,
            agent,
            signal: signal ?? new AbortController().signal,
        });
        if (result.isError)
            throw new KiroCliError(`DSH ${name} rejected the Kiro ACP request: ${result.error.message}`);
        return result.value;
    };
    return {
        async readTextFile(request, signal) {
            const value = await run('read', {
                file_path: request.path,
                ...(request.line === undefined || request.line === 0 ? {} : { offset: request.line }),
                ...(request.limit === undefined || request.limit === 0 ? {} : { limit: request.limit }),
            }, signal);
            return readValue(value);
        },
        async writeTextFile(request, signal) {
            await run('write', { file_path: request.path, content: request.content }, signal);
        },
        async createTerminal(request, signal) {
            if ((request.env?.length ?? 0) > 0) {
                throw new KiroCliError('Kiro ACP terminal environment overrides are not supported by DSH');
            }
            const value = await run('bash', {
                command: terminalCommand(request),
                description: 'Run command requested by Kiro',
                ...(request.cwd === undefined ? {} : { workdir: request.cwd }),
            }, signal);
            return terminalValue(value);
        },
    };
}
