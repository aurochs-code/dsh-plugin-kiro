import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'

function contentText(block: ContentBlock): string {
  switch (block.type) {
    case 'text': return block.text
    case 'reasoning': return `[Reasoning]\n${block.text}`
    case 'tool-call': return `[Tool call: ${block.name}]\n${block.arguments}`
    case 'tool-result': return `[Tool result${block.isError ? ' (error)' : ''}]\n${block.content.map(contentText).join('\n')}`
    case 'image':
      throw new LlmError(
        'dsh-plugin-kiro currently supports text input only; Kiro image prompts are not yet mapped from DSH attachments',
        'UNSUPPORTED',
      )
  }
}

function messageText(message: Message): string {
  return message.content.map(contentText).filter(text => text.length > 0).join('\n')
}

/**
 * Serialize a DSH conversation into one ACP text prompt. A new ACP session is
 * created per request, so all history must travel with the current request.
 */
export function toKiroPrompt(options: Pick<GenerateOptions, 'messages' | 'system'>): string {
  const lines = [
    'You are acting as a text-only language-model provider for DeepSeek Harness.',
    'Do not invoke tools. Return the next assistant response only.',
  ]
  if (options.system !== undefined && options.system.trim().length > 0) {
    lines.push(`SYSTEM:\n${options.system.trim()}`)
  }
  for (const message of options.messages) {
    const text = messageText(message)
    if (text.length === 0) continue
    lines.push(`${message.role.toUpperCase()}:\n${text}`)
  }
  lines.push('ASSISTANT:')
  return lines.join('\n\n')
}
