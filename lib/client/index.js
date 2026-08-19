import { KiroSettingsCard } from './KiroSettingsCard.js';
import { en, zh } from './locales.js';
const NS = 'settings.kiro';
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope'];
/** Register the Kiro ACP card in Settings → Plugins → Plugin configuration. */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-kiro: settings copy');
    const scope = ctx.settingsScope.bind({ namespace: 'kiro' });
    const t = ctx.locale.bind(NS);
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        key: 'kiro',
        locale: NS,
        inject: () => ({ scope, t }),
    }, KiroSettingsCard));
}
