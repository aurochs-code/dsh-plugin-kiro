import { spawn } from 'node:child_process'
import { KiroCliError } from './acp.js'
import { parseKiroModels } from './models.js'
import type { KiroModel } from './models.js'

/** Process-level configuration shared by Kiro CLI probes and ACP sessions. */
export interface KiroCliOptions {
  command: string
  cwd: string
  /** Environment variable where DSH receives an optional Kiro API key. */
  apiKeyEnv: string
}

export interface KiroCommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/** Map a custom secret variable to Kiro's documented `KIRO_API_KEY` input without persisting it. */
export function kiroEnvironment(apiKeyEnv: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const apiKey = env[apiKeyEnv]
  if (apiKey !== undefined && apiKey.length > 0) env.KIRO_API_KEY = apiKey
  return env
}

/** Run one bounded Kiro CLI command without invoking a shell. */
export async function runKiroCommand(
  options: KiroCliOptions,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<KiroCommandResult> {
  if (signal?.aborted === true) throw new Error('Kiro command was aborted')
  return new Promise<KiroCommandResult>((resolve, reject) => {
    let child
    try {
      child = spawn(options.command, [...args], {
        cwd: options.cwd,
        env: kiroEnvironment(options.apiKeyEnv),
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(new KiroCliError(`could not start Kiro CLI at ${options.command}`, error))
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (callback: () => void): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      callback()
    }
    const onAbort = (): void => {
      child.kill()
      finish(() => reject(new Error('Kiro command was aborted')))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.once('error', (error) => finish(() => reject(new KiroCliError(`could not start Kiro CLI at ${options.command}`, error))))
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { stdout = (stdout + chunk).slice(-1_000_000) })
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8_000) })
    child.once('exit', (exitCode) => finish(() => resolve({ exitCode, stdout, stderr })))
  })
}

/** A non-interactive credential check. A nonzero result simply means the provider stays hidden. */
export async function isKiroAuthenticated(options: KiroCliOptions, signal?: AbortSignal): Promise<boolean> {
  const result = await runKiroCommand(options, ['whoami', '--format', 'json'], signal)
  return result.exitCode === 0
}

/** Fetch the model catalog exposed to the current Kiro identity and enterprise policy. */
export async function listKiroModels(options: KiroCliOptions, signal?: AbortSignal): Promise<KiroModel[]> {
  const result = await runKiroCommand(options, ['chat', '--list-models', '--format', 'json'], signal)
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim()
    throw new KiroCliError(`Kiro model discovery failed${detail.length === 0 ? '' : `: ${detail}`}`)
  }
  return parseKiroModels(result.stdout)
}
