#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'

const args = process.argv.slice(2)

if (args[0] === 'whoami') {
  process.stdout.write(`${JSON.stringify({ authentication: 'IAM Identity Center', user: 'test@example.com' })}\n`)
  process.exit(0)
}

if (args[0] === 'chat' && args.includes('--list-models')) {
  if (process.env.FAKE_KIRO_MODELS_LOG !== undefined) appendFileSync(process.env.FAKE_KIRO_MODELS_LOG, 'models\n')
  process.stdout.write(`${JSON.stringify({ models: [
    { id: 'kiro-test', displayName: 'Kiro Test', description: 'Fixture model' },
  ] })}\n`)
  process.exit(0)
}

if (args[0] !== 'acp') process.exit(2)

if (process.env.FAKE_ACP_ARGS_LOG !== undefined) appendFileSync(process.env.FAKE_ACP_ARGS_LOG, `${args.join(' ')}\n`)

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const requirePromptField = process.env.FAKE_ACP_REQUIRES_PROMPT === '1'
const requireContentField = process.env.FAKE_ACP_REQUIRES_CONTENT === '1'
const input = createInterface({ input: process.stdin })
input.on('line', (line) => {
  const request = JSON.parse(line)
  if (request.method === 'initialize') {
    send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: 1 } })
    return
  }
  if (request.method === 'session/new') {
    send({ jsonrpc: '2.0', id: request.id, result: { sessionId: 'fixture-session' } })
    return
  }
  if (request.method === 'session/set_model') {
    send({ jsonrpc: '2.0', id: request.id, result: {} })
    return
  }
  if (request.method === 'session/prompt') {
    if (requirePromptField && request.params.prompt === undefined) {
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Invalid params: prompt required' } })
      return
    }
    if (requireContentField && request.params.content === undefined) {
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Invalid params: content required' } })
      return
    }
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: request.params.sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello ' } },
      },
    })
    send({
      jsonrpc: '2.0',
      method: 'session/notification',
      params: {
        sessionId: request.params.sessionId,
        update: { sessionUpdate: 'AgentMessageChunk', content: { type: 'text', text: 'Kiro' } },
      },
    })
    send({ jsonrpc: '2.0', id: request.id, result: { stopReason: 'end_turn' } })
  }
})
