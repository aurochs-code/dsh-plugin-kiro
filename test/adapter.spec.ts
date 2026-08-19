import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
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
