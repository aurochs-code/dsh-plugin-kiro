import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { RpcResult } from '@deepseek-ai/dsh-client-connection/client'
import { kiroEnvironment, runKiroCommand } from './cli.js'
import type { KiroCliOptions } from './cli.js'

const LOGIN_OUTPUT_LIMIT = 32_000
const LOGIN_TIMEOUT_MS = 10 * 60 * 1_000

export type KiroAuthenticationState = 'authenticated' | 'signed-out' | 'unavailable'
export type KiroLoginState = 'idle' | 'waiting' | 'complete' | 'failed' | 'cancelled' | 'expired'

/** Non-secret identity fields returned by Kiro CLI's `whoami --format json` command. */
export interface KiroIdentity {
  accountType?: string
  email?: string
}

/** Browser handoff details extracted from Kiro CLI's device-flow output. */
export interface KiroDeviceFlow {
  url?: string
  code?: string
}

/** The visible lifecycle of one user-initiated enterprise sign-in. */
export interface KiroLoginOperation extends KiroDeviceFlow {
  state: KiroLoginState
  startedAt?: number
  message?: string
}

/** Authentication view sent to the settings card. It deliberately contains no credential material. */
export interface KiroAuthenticationStatus {
  state: KiroAuthenticationState
  identity?: KiroIdentity
  login: KiroLoginOperation
}

export interface KiroAuthenticationServiceOptions {
  resolveCommand: () => KiroCliOptions
  onAuthenticated?: () => void
}

type InternalLoginOperation = KiroLoginOperation & {
  output: string
  child?: ChildProcess
  authenticationNotified?: boolean
}

export type KiroAuthenticationRpcResult = RpcResult<KiroAuthenticationStatus>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim()
  }
  return undefined
}

function outputJsonLine(output: string): Record<string, unknown> | undefined {
  for (const line of output.split(/\r?\n/)) {
    try {
      const value = JSON.parse(line) as unknown
      if (isRecord(value)) return value
    } catch {
      // Kiro may print a human-readable profile after its JSON line.
    }
  }
  return undefined
}

/** Parse the stable, non-secret part of `kiro-cli whoami --format json`. */
export function parseKiroIdentity(output: string): KiroIdentity | undefined {
  const value = outputJsonLine(output)
  if (value === undefined) return undefined
  const accountType = stringField(value, ['accountType', 'authentication'])
  const email = stringField(value, ['email', 'user', 'username'])
  return accountType === undefined && email === undefined
    ? undefined
    : { ...(accountType === undefined ? {} : { accountType }), ...(email === undefined ? {} : { email }) }
}

function secureUrl(value: string): string | undefined {
  try {
    const url = new URL(value.replace(/[),.;]+$/, ''))
    if (url.protocol !== 'https:' || url.username.length > 0 || url.password.length > 0) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

/** Extract only a device URL and a one-time code; never return arbitrary CLI output to the browser. */
export function parseKiroDeviceFlow(output: string): KiroDeviceFlow {
  const url = [...output.matchAll(/https:\/\/[^\s<>'"`]+/g)]
    .map(match => secureUrl(match[0]))
    .find((candidate): candidate is string => candidate !== undefined)
  const code = output.match(/(?:device|verification|one[- ]?time)\s+code\s*(?:is|:)?\s*[`'“”"]?([A-Z0-9]{4,}(?:[- ][A-Z0-9]{3,})+)/i)
    ?? output.match(/(?:enter|use)\s+(?:the\s+)?code\s*(?:is|:)?\s*[`'“”"]?([A-Z0-9]{4,}(?:[- ][A-Z0-9]{3,})+)/i)
  return {
    ...(url === undefined ? {} : { url }),
    ...(code?.[1] === undefined ? {} : { code: code[1] }),
  }
}

function emptyLogin(): KiroLoginOperation {
  return { state: 'idle' }
}

function failure(code: 'bad-request' | 'cancelled' | 'internal', message: string): KiroAuthenticationRpcResult {
  if (code === 'bad-request') return { ok: false, error: { code, message, details: { issues: [] } } }
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Owns one device-code process on the DSH host. The browser never supplies a
 * command, URL, argument, or credential; the only spawn argv is fixed here.
 */
export class KiroAuthenticationService {
  private operation: InternalLoginOperation | undefined
  private lastAuthenticated: boolean | undefined

  constructor(private readonly options: KiroAuthenticationServiceOptions) {}

  async status(signal?: AbortSignal): Promise<KiroAuthenticationStatus> {
    this.expireLogin()
    let result
    try {
      result = await runKiroCommand(this.options.resolveCommand(), ['whoami', '--format', 'json'], signal)
    } catch {
      this.lastAuthenticated = undefined
      return { state: 'unavailable', login: this.loginView() }
    }
    const authenticated = result.exitCode === 0
    const completedLogin = this.operation?.state === 'complete' && this.operation.authenticationNotified !== true
    const becameAuthenticated = this.lastAuthenticated === false && authenticated
    if (authenticated && (completedLogin || becameAuthenticated)) {
      this.options.onAuthenticated?.()
      if (completedLogin && this.operation !== undefined) this.operation.authenticationNotified = true
    }
    this.lastAuthenticated = authenticated
    const identity = authenticated ? parseKiroIdentity(result.stdout) : undefined
    return {
      state: authenticated ? 'authenticated' : 'signed-out',
      ...(identity === undefined ? {} : { identity }),
      login: this.loginView(),
    }
  }

  /** Start Kiro's documented Identity Center device flow with a fixed argv. */
  async startEnterpriseLogin(): Promise<KiroAuthenticationStatus> {
    this.expireLogin()
    if (this.operation?.state === 'waiting') return this.status()

    const command = this.options.resolveCommand()
    let child: ChildProcess
    try {
      child = spawn(command.command, ['login', '--use-device-flow', '--license', 'pro'], {
        cwd: command.cwd,
        env: kiroEnvironment(command.apiKeyEnv),
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      this.operation = {
        state: 'failed',
        startedAt: Date.now(),
        message: 'Kiro CLI could not be started.',
        output: '',
      }
      return this.status()
    }

    const operation: InternalLoginOperation = {
      state: 'waiting',
      startedAt: Date.now(),
      output: '',
      child,
    }
    this.operation = operation
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => this.appendOutput(operation, chunk))
    child.stderr?.on('data', (chunk: string) => this.appendOutput(operation, chunk))
    child.once('error', () => this.finish(operation, 'failed', 'Kiro CLI could not be started.'))
    child.once('close', (exitCode, signal) => {
      if (signal !== null) this.finish(operation, 'cancelled', 'Sign-in was cancelled.')
      else if (exitCode === 0) this.finish(operation, 'complete')
      else this.finish(operation, 'failed', 'Kiro CLI ended before sign-in completed.')
    })
    return this.status()
  }

  async cancelLogin(): Promise<KiroAuthenticationStatus> {
    const operation = this.operation
    if (operation?.state === 'waiting') {
      this.finish(operation, 'cancelled', 'Sign-in was cancelled.')
      try {
        operation.child?.kill()
      } catch {
        // The process may have exited between the state change and kill.
      }
    }
    return this.status()
  }

  /** Stop only the plugin-owned device-flow subprocess during plugin teardown. */
  close(): void {
    if (this.operation?.state !== 'waiting') return
    try {
      this.operation.child?.kill()
    } catch {
      // The process is already gone.
    }
  }

  private appendOutput(operation: InternalLoginOperation, chunk: string): void {
    if (this.operation !== operation || operation.state !== 'waiting') return
    operation.output = (operation.output + chunk).slice(-LOGIN_OUTPUT_LIMIT)
  }

  private finish(operation: InternalLoginOperation, state: Exclude<KiroLoginState, 'idle' | 'waiting' | 'expired'>, message?: string): void {
    if (this.operation !== operation || operation.state !== 'waiting') return
    operation.state = state
    if (message !== undefined) operation.message = message
    delete operation.child
  }

  private expireLogin(): void {
    const operation = this.operation
    if (operation?.state !== 'waiting' || operation.startedAt === undefined || Date.now() - operation.startedAt < LOGIN_TIMEOUT_MS) return
    operation.state = 'expired'
    operation.message = 'Sign-in timed out. Start it again to receive a new code.'
    try {
      operation.child?.kill()
    } catch {
      // The process is already gone.
    }
    delete operation.child
  }

  private loginView(): KiroLoginOperation {
    const operation = this.operation
    if (operation === undefined) return emptyLogin()
    const deviceFlow = parseKiroDeviceFlow(operation.output)
    return {
      state: operation.state,
      ...(operation.startedAt === undefined ? {} : { startedAt: operation.startedAt }),
      ...(operation.message === undefined ? {} : { message: operation.message }),
      ...deviceFlow,
    }
  }
}

/** Create the loopback-only RPC handler used by the browser settings card. */
export function createKiroAuthenticationRpcHandler(service: KiroAuthenticationService): (
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
) => Promise<KiroAuthenticationRpcResult> {
  return async (endpoint, payload, signal) => {
    if (!isRecord(payload) || Object.keys(payload).length !== 0) {
      return failure('bad-request', 'Kiro authentication requests do not accept parameters.')
    }
    if (signal.aborted) return failure('cancelled', 'Kiro authentication request was cancelled.')
    try {
      if (endpoint === 'status') return { ok: true, value: await service.status(signal) }
      if (endpoint === 'enterprise-login') return { ok: true, value: await service.startEnterpriseLogin() }
      if (endpoint === 'cancel-login') return { ok: true, value: await service.cancelLogin() }
      return failure('internal', 'Unknown Kiro authentication action.')
    } catch {
      return failure('internal', 'Kiro authentication could not be checked.')
    }
  }
}
