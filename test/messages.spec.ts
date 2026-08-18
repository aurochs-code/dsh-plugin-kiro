import assert from 'node:assert/strict'
import test from 'node:test'
import { createAssistantMessage, createUserMessage, LlmError } from '@deepseek-ai/dsh-llm'
import type { Message } from '@deepseek-ai/dsh-llm'
import { toKiroPrompt } from '../src/messages.js'

test('serializes DSH text history into one ACP prompt', () => {
  const prompt = toKiroPrompt({
    system: 'Be concise.',
    messages: [
      createUserMessage({ content: [{ type: 'text', text: 'Hi' }], source: { kind: 'user' } }),
      createAssistantMessage({
        content: [{ type: 'text', text: 'Hello' }],
        source: { provider: 'kiro', model: 'kiro-test' },
      }),
    ],
  })
  assert.match(prompt, /SYSTEM:\nBe concise\./)
  assert.match(prompt, /USER:\nHi/)
  assert.match(prompt, /ASSISTANT:\nHello/)
  assert.match(prompt, /ASSISTANT:$/)
})

test('rejects image input instead of silently dropping it', () => {
  const imageMessage = {
    role: 'user',
    content: [{
      type: 'image',
      attachment: {},
    }],
    source: { kind: 'user' },
  } as unknown as Message
  assert.throws(
    () => toKiroPrompt({ messages: [imageMessage] }),
    (error: unknown) => error instanceof LlmError && error.code === 'UNSUPPORTED',
  )
})
