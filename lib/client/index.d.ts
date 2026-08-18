import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { KiroSettingsKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.kiro': KiroSettingsKey;
    }
}
export declare const inject: string[];
/** Register the Kiro ACP card in Settings → Plugins → Plugin configuration. */
export declare function apply(ctx: ClientContext): void;
export type { KiroSettings, KiroSettingsCardInjected, KiroSettingsCardProps } from './KiroSettingsCard.js';
export type { KiroSettingsKey } from './locales.js';
