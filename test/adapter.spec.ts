import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAssistantMessage, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { fileURLToPath } from 'node:url'
import { KiroAdapter } from '../src/adapter.js'

const fixture = fileURLToPath(new URL('../../test/fixtures/fake-kiro-cli.mjs', import.meta.url))

test('discovers models and maps an ACP response to DSH stream chunks', async () => {
  const adapter = new KiroAdapter({
    command: fixture,
    cwd: process.cwd(),
    apiKeyEnv: 'KIRO_API_KEY',
    models: [],
  })
  const models = await adapter.listModels('kiro')
  assert.deepEqual(models, [{
    provider: 'kiro',
    id: 'kiro-test',
    name: 'Kiro Test',
    description: 'Fixture model',
    inputModalities: ['text'],
  }])
  const chunks = []
  for await (const chunk of adapter.stream({
    provider: 'kiro',
    model: 'kiro-test',
    messages: [createUserMessage({ content: [{ type: 'text', text: 'Hello' }], source: { kind: 'user' } })],
  })) chunks.push(chunk)
  assert.deepEqual(chunks, [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: 'Hello ' },
    { type: 'text-delta', index: 0, text: 'Kiro' },
    { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello Kiro' } },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
})

test('caches and coalesces Kiro model discovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-'))
  const log = join(directory, 'models.log')
  const original = process.env.FAKE_KIRO_MODELS_LOG
  process.env.FAKE_KIRO_MODELS_LOG = log
  try {
    const adapter = new KiroAdapter({
      command: fixture,
      cwd: process.cwd(),
      apiKeyEnv: 'KIRO_API_KEY',
      models: [],
    })
    await Promise.all([
      adapter.listModels('kiro'),
      adapter.listModels('kiro'),
      adapter.listModels('kiro'),
    ])
    await adapter.listModels('kiro')
    assert.equal((await readFile(log, 'utf8')).trim().split('\n').length, 1)
  } finally {
    if (original === undefined) delete process.env.FAKE_KIRO_MODELS_LOG
    else process.env.FAKE_KIRO_MODELS_LOG = original
    await rm(directory, { recursive: true, force: true })
  }
})

test('uses the DSH session workspace when ACP cwd is not configured', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-workspace-'))
  const log = join(workspace, 'acp-cwd.log')
  const original = process.env.FAKE_ACP_CWD_LOG
  process.env.FAKE_ACP_CWD_LOG = log
  let adapter: KiroAdapter | undefined
  try {
    adapter = new KiroAdapter({
      command: fixture,
      apiKeyEnv: 'KIRO_API_KEY',
      models: [],
      resolveSessionCwd: sessionId => sessionId === 'workspace-session' ? workspace : undefined,
    })
    const messages = [createUserMessage({
      content: [{ type: 'text', text: 'Hello' }],
      source: { kind: 'user' },
    })]
    for await (const _chunk of adapter.stream({
      provider: 'kiro',
      model: 'kiro-test',
      messages,
      sessionId: 'workspace-session' as never,
    })) {
      // Consume the fixture stream so the ACP request completes.
    }
    assert.equal((await readFile(log, 'utf8')).trim(), await realpath(workspace))
  } finally {
    adapter?.close()
    if (original === undefined) delete process.env.FAKE_ACP_CWD_LOG
    else process.env.FAKE_ACP_CWD_LOG = original
    await rm(workspace, { recursive: true, force: true })
  }
})

test('reuses an ACP session and sends only new conversation data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-'))
  const rpcLog = join(directory, 'rpc.log')
  const promptLog = join(directory, 'prompt.log')
  const originalRpcLog = process.env.FAKE_ACP_RPC_LOG
  const originalPromptLog = process.env.FAKE_ACP_PROMPT_LOG
  process.env.FAKE_ACP_RPC_LOG = rpcLog
  process.env.FAKE_ACP_PROMPT_LOG = promptLog
  const adapter = new KiroAdapter({
    command: fixture,
    cwd: process.cwd(),
    apiKeyEnv: 'KIRO_API_KEY',
    models: [],
  })
  const first = createUserMessage({
    content: [{ type: 'text', text: 'First request' }],
    source: { kind: 'user' },
  })
  try {
    for await (const _chunk of adapter.stream({
      provider: 'kiro',
      model: 'kiro-test',
      messages: [first],
      sessionId: 'reused-session' as never,
    })) {
      // Consume the first response before issuing the continuation.
    }
    for await (const _chunk of adapter.stream({
      provider: 'kiro',
      model: 'kiro-test',
      messages: [
        first,
        createAssistantMessage({
          content: [{ type: 'text', text: 'Hello Kiro' }],
          source: { provider: 'kiro', model: 'kiro-test' },
        }),
        createUserMessage({
          content: [{ type: 'text', text: 'Second request' }],
          source: { kind: 'user' },
        }),
      ],
      sessionId: 'reused-session' as never,
    })) {
      // Consume the continuation response.
    }
    const calls = (await readFile(rpcLog, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { method: string })
    assert.equal(calls.filter(call => call.method === 'session/new').length, 1)
    assert.equal(calls.filter(call => call.method === 'session/set_model').length, 1)
    const prompts = (await readFile(promptLog, 'utf8')).trim().split('\n').map(line => {
      const content = JSON.parse(line) as { type: string; text: string }[]
      return content[0]!.text
    })
    assert.equal(prompts.length, 2)
    assert.match(prompts[1]!, /New conversation JSON/)
    assert.match(prompts[1]!, /Second request/)
    assert.doesNotMatch(prompts[1]!, /Hello Kiro/)
  } finally {
    adapter.close()
    if (originalRpcLog === undefined) delete process.env.FAKE_ACP_RPC_LOG
    else process.env.FAKE_ACP_RPC_LOG = originalRpcLog
    if (originalPromptLog === undefined) delete process.env.FAKE_ACP_PROMPT_LOG
    else process.env.FAKE_ACP_PROMPT_LOG = originalPromptLog
    await rm(directory, { recursive: true, force: true })
  }
})

test('advertises Kiro effort levels and sends the selected ACP effort', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-'))
  const log = join(directory, 'acp.log')
  const original = process.env.FAKE_ACP_ARGS_LOG
  process.env.FAKE_ACP_ARGS_LOG = log
  try {
    const adapter = new KiroAdapter({
      command: fixture,
      cwd: process.cwd(),
      apiKeyEnv: 'KIRO_API_KEY',
      models: [],
      defaultEffort: 'high',
    })
    const resolved = await adapter.resolveModel('kiro', 'kiro-test')
    assert.deepEqual(resolved.reasoning?.efforts.map(effort => effort.id), ['low', 'medium', 'high', 'xhigh', 'max'])
    assert.equal(resolved.reasoning?.defaultEffort, 'high')

    const messages = [createUserMessage({
      content: [{ type: 'text', text: 'Hello' }],
      source: { kind: 'user' },
    })]
    for await (const _chunk of adapter.stream({
      provider: 'kiro',
      model: 'kiro-test',
      reasoningEffort: ReasoningEffortId('max'),
      messages,
    })) {
      // Consume the fixture stream so the ACP request completes.
    }
    for await (const _chunk of adapter.stream({
      provider: 'kiro',
      model: 'kiro-test',
      messages,
    })) {
      // The resolved default applies when the conversation has no explicit choice.
    }

    assert.deepEqual((await readFile(log, 'utf8')).trim().split('\n'), [
      'acp --effort max',
      'acp --effort high',
    ])
  } finally {
    if (original === undefined) delete process.env.FAKE_ACP_ARGS_LOG
    else process.env.FAKE_ACP_ARGS_LOG = original
    await rm(directory, { recursive: true, force: true })
  }
})
