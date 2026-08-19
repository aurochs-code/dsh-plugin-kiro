import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { KiroAcpClient } from '../src/acp.js'

const fixture = fileURLToPath(new URL('../../test/fixtures/fake-kiro-cli.mjs', import.meta.url))

async function completePrompt(client: KiroAcpClient): Promise<string> {
  await client.initialize()
  const sessionId = await client.newSession(process.cwd())
  await client.setModel(sessionId, 'kiro-test')
  const chunks: string[] = []
  for await (const chunk of client.prompt(sessionId, 'Say hello')) chunks.push(chunk)
  return chunks.join('')
}

test('streams Kiro ACP text chunks', async () => {
  const client = new KiroAcpClient({ command: fixture, cwd: process.cwd() })
  try {
    assert.equal(await completePrompt(client), 'Hello Kiro')
  } finally {
    client.close()
  }
})

test('uses the prompt field required by current Kiro CLI releases', async () => {
  const client = new KiroAcpClient({
    command: fixture,
    cwd: process.cwd(),
    env: { ...process.env, FAKE_ACP_REQUIRES_PROMPT: '1' },
  })
  try {
    assert.equal(await completePrompt(client), 'Hello Kiro')
  } finally {
    client.close()
  }
})

test('falls back to the content field used by older ACP agents', async () => {
  const client = new KiroAcpClient({
    command: fixture,
    cwd: process.cwd(),
    env: { ...process.env, FAKE_ACP_REQUIRES_CONTENT: '1' },
  })
  try {
    assert.equal(await completePrompt(client), 'Hello Kiro')
  } finally {
    client.close()
  }
})

test('ignores Kiro tool status updates while waiting for the final text', async () => {
  const client = new KiroAcpClient({
    command: fixture,
    cwd: process.cwd(),
    env: { ...process.env, FAKE_ACP_TOOL_UPDATE: '1' },
  })
  try {
    assert.equal(await completePrompt(client), 'Hello Kiro')
  } finally {
    client.close()
  }
})
