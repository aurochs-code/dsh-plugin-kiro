import type { RpcResult } from '@deepseek-ai/dsh-client-connection/client';
import type { KiroCliOptions } from './cli.js';
export type KiroAuthenticationState = 'authenticated' | 'signed-out' | 'unavailable';
export type KiroLoginState = 'idle' | 'waiting' | 'complete' | 'failed' | 'cancelled' | 'expired';
/** Non-secret identity fields returned by Kiro CLI's `whoami --format json` command. */
export interface KiroIdentity {
    accountType?: string;
    email?: string;
}
/** Browser handoff details extracted from Kiro CLI's device-flow output. */
export interface KiroDeviceFlow {
    url?: string;
    code?: string;
}
/** The visible lifecycle of one user-initiated enterprise sign-in. */
export interface KiroLoginOperation extends KiroDeviceFlow {
    state: KiroLoginState;
    startedAt?: number;
    message?: string;
}
/** Authentication view sent to the settings card. It deliberately contains no credential material. */
export interface KiroAuthenticationStatus {
    state: KiroAuthenticationState;
    identity?: KiroIdentity;
    login: KiroLoginOperation;
}
export interface KiroAuthenticationServiceOptions {
    resolveCommand: () => KiroCliOptions;
    onAuthenticated?: () => void;
}
export type KiroAuthenticationRpcResult = RpcResult<KiroAuthenticationStatus>;
/** Parse the stable, non-secret part of `kiro-cli whoami --format json`. */
export declare function parseKiroIdentity(output: string): KiroIdentity | undefined;
/** Extract only a device URL and a one-time code; never return arbitrary CLI output to the browser. */
export declare function parseKiroDeviceFlow(output: string): KiroDeviceFlow;
/**
 * Owns one device-code process on the DSH host. The browser never supplies a
 * command, URL, argument, or credential; the only spawn argv is fixed here.
 */
export declare class KiroAuthenticationService {
    private readonly options;
    private operation;
    private lastAuthenticated;
    constructor(options: KiroAuthenticationServiceOptions);
    status(signal?: AbortSignal): Promise<KiroAuthenticationStatus>;
    /** Start Kiro's documented Identity Center device flow with a fixed argv. */
    startEnterpriseLogin(): Promise<KiroAuthenticationStatus>;
    cancelLogin(): Promise<KiroAuthenticationStatus>;
    /** Stop only the plugin-owned device-flow subprocess during plugin teardown. */
    close(): void;
    private appendOutput;
    private finish;
    private expireLogin;
    private loginView;
}
/** Create the loopback-only RPC handler used by the browser settings card. */
export declare function createKiroAuthenticationRpcHandler(service: KiroAuthenticationService): (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<KiroAuthenticationRpcResult>;
