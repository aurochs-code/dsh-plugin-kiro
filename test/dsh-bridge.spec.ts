import assert from 'node:assert/strict'
import test from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import { createDshToolHandlers } from '../src/dsh-bridge.js'

interface RecordedCall {
  name: string
  arguments: unknown
  agent: unknown
  signal: AbortSignal
}

test('routes ACP filesystem and terminal callbacks through DSH tools', async () => {
  const sessionId = 'bridge-session' as never
  const agent = {}
  const calls: RecordedCall[] = []
  const ctx = {
    agents: { get: (id: unknown) => id === sessionId ? agent : undefined },
    tools: {
      async execute(call: RecordedCall): Promise<unknown> {
        calls.push(call)
        if (call.name === 'read') {
          return { isError: false, value: { lines: [{ text: 'alpha' }, { text: 'beta' }] } }
        }
        if (call.name === 'bash') {
          return {
            isError: false,
            value: {
              kind: 'foreground',
              exitCode: 0,
              signal: null,
              stdout: { text: 'clean', truncated: false },
              stderr: { text: '', truncated: false },
            },
          }
        }
        return { isError: false, value: {} }
      },
    },
  } as unknown as Context
  const handlers = createDshToolHandlers(ctx, sessionId)
  if (handlers === undefined || handlers.readTextFile === undefined || handlers.writeTextFile === undefined || handlers.createTerminal === undefined) {
    throw new Error('expected DSH ACP handlers')
  }

  assert.equal(await handlers.readTextFile({ sessionId: 'kiro-session', path: 'src/index.ts', line: 7, limit: 2 }), 'alpha\nbeta')
  await handlers.writeTextFile({ sessionId: 'kiro-session', path: 'src/index.ts', content: 'updated' })
  assert.deepEqual(await handlers.createTerminal({
    sessionId: 'kiro-session',
    command: 'git',
    args: ['status', '--short'],
    cwd: 'worktree',
  }), {
    output: 'clean',
    truncated: false,
    exitCode: 0,
    signal: null,
  })

  assert.deepEqual(calls.map(call => [call.name, call.arguments]), [
    ['read', { file_path: 'src/index.ts', offset: 7, limit: 2 }],
    ['write', { file_path: 'src/index.ts', content: 'updated' }],
    ['bash', {
      command: "'git' 'status' '--short'",
      description: 'Run command requested by Kiro',
      workdir: 'worktree',
    }],
  ])
  assert.equal(calls.every(call => call.agent === agent && call.signal instanceof AbortSignal), true)
})

test('surfaces a DSH denial to Kiro instead of executing around it', async () => {
  const sessionId = 'denied-session' as never
  const agent = {}
  const ctx = {
    agents: { get: () => agent },
    tools: {
      async execute(): Promise<unknown> {
        return { isError: true, error: { message: 'write approval denied' } }
      },
    },
  } as unknown as Context
  const handlers = createDshToolHandlers(ctx, sessionId)
  if (handlers?.writeTextFile === undefined) throw new Error('expected DSH write handler')
  await assert.rejects(
    handlers.writeTextFile({ sessionId: 'kiro-session', path: 'src/index.ts', content: 'updated' }),
    /DSH write rejected the Kiro ACP request: write approval denied/,
  )
})
