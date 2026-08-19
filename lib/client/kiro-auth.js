function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function optionalString(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function statusValue(value) {
    if (!isRecord(value))
        throw new Error('Kiro authentication returned an invalid response.');
    const state = value.state;
    const login = value.login;
    if ((state !== 'authenticated' && state !== 'signed-out' && state !== 'unavailable') || !isRecord(login)) {
        throw new Error('Kiro authentication returned an invalid response.');
    }
    const loginState = login.state;
    if (loginState !== 'idle' && loginState !== 'waiting' && loginState !== 'complete' && loginState !== 'failed' && loginState !== 'cancelled' && loginState !== 'expired') {
        throw new Error('Kiro authentication returned an invalid response.');
    }
    const accountType = isRecord(value.identity) ? optionalString(value.identity.accountType) : undefined;
    const email = isRecord(value.identity) ? optionalString(value.identity.email) : undefined;
    const url = optionalString(login.url);
    const code = optionalString(login.code);
    const message = optionalString(login.message);
    const identity = accountType === undefined && email === undefined
        ? undefined
        : { ...(accountType === undefined ? {} : { accountType }), ...(email === undefined ? {} : { email }) };
    return {
        state,
        ...(identity === undefined ? {} : { identity }),
        login: {
            state: loginState,
            ...(typeof login.startedAt === 'number' ? { startedAt: login.startedAt } : {}),
            ...(url === undefined ? {} : { url }),
            ...(code === undefined ? {} : { code }),
            ...(message === undefined ? {} : { message }),
        },
    };
}
async function call(rpc, endpoint, signal) {
    const result = await rpc.call('/kiro-auth', endpoint, {}, signal);
    if (!result.ok)
        throw new Error(result.error?.message ?? 'Kiro authentication request failed.');
    return statusValue(result.value);
}
/** Bind the settings card to the plugin's loopback-only authentication channel. */
export function createKiroAuthenticationClient(rpc) {
    return {
        status: signal => call(rpc, 'status', signal),
        startEnterpriseLogin: signal => call(rpc, 'enterprise-login', signal),
        cancelLogin: signal => call(rpc, 'cancel-login', signal),
    };
}
