import { KiroSettingsCard } from './KiroSettingsCard.js';
import { createKiroAuthenticationClient } from './kiro-auth.js';
import { en, zh } from './locales.js';
const NS = 'settings.kiro';
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope'];
/** Register the Kiro ACP card in Settings → Plugins → Plugin configuration. */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-kiro: settings copy');
    const scope = ctx.settingsScope.bind({ namespace: 'kiro' });
    const t = ctx.locale.bind(NS);
    const connection = ctx.connection;
    const authentication = createKiroAuthenticationClient(connection.rpc);
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        key: 'kiro',
        locale: NS,
        inject: () => ({ scope, t, authentication, canManageAuthentication: connection.isLoopback }),
    }, KiroSettingsCard));
}
