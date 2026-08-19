import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  createKiroAuthenticationRpcHandler,
  KiroAuthenticationService,
  parseKiroDeviceFlow,
  parseKiroIdentity,
} from '../src/auth.js'

const fixture = fileURLToPath(new URL('../../test/fixtures/fake-kiro-cli.mjs', import.meta.url))

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

test('parses only non-secret Kiro identity and device-flow fields', () => {
  assert.deepEqual(
    parseKiroIdentity('{"accountType":"IamIdentityCenter","email":"person@example.test"}\nProfile: example'),
    { accountType: 'IamIdentityCenter', email: 'person@example.test' },
  )
  assert.deepEqual(
    parseKiroDeviceFlow('Open https://signin.example.test/device?client=kiro and enter device code ABCD-EFGH.'),
    { url: 'https://signin.example.test/device?client=kiro', code: 'ABCD-EFGH' },
  )
  assert.deepEqual(parseKiroDeviceFlow('untrusted output with no device handoff'), {})
})

test('starts a fixed enterprise device-flow command', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-plugin-kiro-auth-'))
  const log = join(directory, 'login.log')
  process.env.FAKE_KIRO_LOGIN_LOG = log
  let refreshedCatalog = 0
  const service = new KiroAuthenticationService({
    resolveCommand: () => ({ command: fixture, cwd: process.cwd(), apiKeyEnv: 'KIRO_API_KEY' }),
    onAuthenticated: () => { refreshedCatalog += 1 },
  })
  try {
    let status = await service.startEnterpriseLogin()
    const deadline = Date.now() + 1_000
    while ((status.login.code === undefined || status.login.state !== 'complete') && Date.now() < deadline) {
      await sleep(20)
      status = await service.status()
    }
    assert.equal(status.login.url, 'https://auth.example.test/device')
    assert.equal(status.login.code, 'ABCD-EFGH')
    assert.equal(await readFile(log, 'utf8'), 'login --use-device-flow --license pro\n')
    assert.equal(refreshedCatalog, 1)
  } finally {
    service.close()
    delete process.env.FAKE_KIRO_LOGIN_LOG
    await rm(directory, { recursive: true, force: true })
  }
})

test('authentication RPC rejects caller-supplied login parameters', async () => {
  const calls: string[] = []
  const handler = createKiroAuthenticationRpcHandler({
    async status() {
      calls.push('status')
      return { state: 'signed-out', login: { state: 'idle' } }
    },
    async startEnterpriseLogin() {
      calls.push('login')
      return { state: 'signed-out', login: { state: 'waiting' } }
    },
    async cancelLogin() {
      calls.push('cancel')
      return { state: 'signed-out', login: { state: 'cancelled' } }
    },
  } as unknown as KiroAuthenticationService)

  const rejected = await handler('enterprise-login', { command: 'not-allowed' }, new AbortController().signal)
  assert.deepEqual(rejected, {
    ok: false,
    error: { code: 'bad-request', message: 'Kiro authentication requests do not accept parameters.', details: { issues: [] } },
  })
  const accepted = await handler('enterprise-login', {}, new AbortController().signal)
  assert.equal(accepted.ok, true)
  assert.deepEqual(calls, ['login'])
})
