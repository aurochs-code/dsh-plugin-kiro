import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { Config as KiroConfig } from '../index.js';
import type { KiroSettingsKey } from './locales.js';
export type KiroSettings = Pick<KiroConfig, 'command' | 'cwd' | 'apiKeyEnv' | 'defaultEffort'>;
export interface KiroSettingsCardInjected {
    scope: SettingsScope<KiroSettings>;
    t: (key: KiroSettingsKey) => string;
}
export type KiroSettingsCardProps = Partial<KiroSettingsCardInjected>;
export declare function KiroSettingsCard(props: KiroSettingsCardProps): JSX.Element | null;
