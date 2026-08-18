import assert from 'node:assert/strict'
import test from 'node:test'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
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
