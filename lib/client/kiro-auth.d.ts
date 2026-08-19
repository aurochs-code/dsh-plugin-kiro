import type { KiroAuthenticationStatus } from '../auth.js';
export interface KiroAuthenticationRpc {
    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<{
        ok: boolean;
        value?: unknown;
        error?: {
            message?: string;
        };
    }>;
}
export interface KiroAuthenticationClient {
    status(signal?: AbortSignal): Promise<KiroAuthenticationStatus>;
    startEnterpriseLogin(signal?: AbortSignal): Promise<KiroAuthenticationStatus>;
    cancelLogin(signal?: AbortSignal): Promise<KiroAuthenticationStatus>;
}
/** Bind the settings card to the plugin's loopback-only authentication channel. */
export declare function createKiroAuthenticationClient(rpc: KiroAuthenticationRpc): KiroAuthenticationClient;
