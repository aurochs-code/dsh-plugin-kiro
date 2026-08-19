import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { KiroSettingsCard } from './KiroSettingsCard.js'
import type { KiroSettings, KiroSettingsCardInjected } from './KiroSettingsCard.js'
import { createKiroAuthenticationClient } from './kiro-auth.js'
import { en, zh } from './locales.js'
import type { KiroSettingsKey } from './locales.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.kiro': KiroSettingsKey
  }
}

const NS = 'settings.kiro'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/** Register the Kiro ACP card in Settings → Plugins → Plugin configuration. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-kiro: settings copy')
  const scope = ctx.settingsScope.bind<KiroSettings>({ namespace: 'kiro' })
  const t = ctx.locale.bind(NS) as KiroSettingsCardInjected['t']
  const connection = (ctx as unknown as { connection: ConnectionHandle }).connection
  const authentication = createKiroAuthenticationClient(connection.rpc)
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'kiro',
    locale: NS,
    inject: (): KiroSettingsCardInjected => ({ scope, t, authentication, canManageAuthentication: connection.isLoopback }),
  }, KiroSettingsCard))
}

export type { KiroSettings, KiroSettingsCardInjected, KiroSettingsCardProps } from './KiroSettingsCard.js'
export type { KiroSettingsKey } from './locales.js'
