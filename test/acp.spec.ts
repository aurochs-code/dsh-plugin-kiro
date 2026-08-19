import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('routes ACP filesystem callbacks to the configured DSH handler', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-'))
  const capabilitiesLog = join(directory, 'capabilities.log')
  const resultLog = join(directory, 'result.log')
  const reads: unknown[] = []
  const client = new KiroAcpClient({
    command: fixture,
    cwd: process.cwd(),
    env: {
      ...process.env,
      FAKE_ACP_CLIENT_READ: '1',
      FAKE_ACP_CAPABILITIES_LOG: capabilitiesLog,
      FAKE_ACP_CLIENT_RESULT_LOG: resultLog,
    },
    handlers: {
      async readTextFile(request) {
        reads.push(request)
        return 'alpha\nbeta'
      },
    },
  })
  try {
    assert.equal(await completePrompt(client), 'Hello Kiro')
    assert.deepEqual(reads, [{
      sessionId: 'fixture-session',
      path: '/workspace/fixture.txt',
      line: 1,
      limit: 2,
    }])
    assert.deepEqual(JSON.parse((await readFile(capabilitiesLog, 'utf8')).trim()), {
      fs: { readTextFile: true },
    })
    assert.deepEqual(JSON.parse((await readFile(resultLog, 'utf8')).trim()).result, { content: 'alpha\nbeta' })
  } finally {
    client.close()
    await rm(directory, { recursive: true, force: true })
  }
})
