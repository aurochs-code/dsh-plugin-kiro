import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../src/client/index.js'

test('registers the Kiro ACP card in the plugin configuration slot', () => {
  const scope = {}
  const registrations: { name: string; value: unknown }[] = []
  let localeNamespace = ''
  const ctx = {
    effect(callback: () => unknown): void {
      callback()
    },
    locale: {
      register(namespace: string): void {
        localeNamespace = namespace
      },
      bind(): (key: string) => string {
        return key => key
      },
    },
    settingsScope: {
      bind(): unknown {
        return scope
      },
    },
    slots: {
      inject(name: string, factory: () => unknown): void {
        registrations.push({ name, value: factory() })
      },
      register(options: unknown, component: unknown): unknown {
        return { options, component }
      },
    },
  }

  apply(ctx as never)

  assert.equal(localeNamespace, 'settings.kiro')
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0]?.name, 'settings.plugin.item')
  const registration = registrations[0]?.value as { options: { key: string; locale: string; inject: () => { scope: unknown } } }
  assert.equal(registration.options.key, 'kiro')
  assert.equal(registration.options.locale, 'settings.kiro')
  assert.equal(registration.options.inject().scope, scope)
})
