import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { KIRO_REASONING_EFFORTS } from '../effort.js';
const FIELDS = ['command', 'cwd', 'apiKeyEnv', 'defaultEffort'];
const QUOTA_HELP_URL = 'https://kiro.dev/docs/cli/billing/subscription-portal/';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringValue(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
function toDraft(value) {
    return {
        command: stringValue(value?.command, 'kiro-cli'),
        cwd: stringValue(value?.cwd),
        apiKeyEnv: stringValue(value?.apiKeyEnv, 'KIRO_API_KEY'),
        defaultEffort: stringValue(value?.defaultEffort),
    };
}
function sameDraft(left, right) {
    return FIELDS.every(field => left[field] === right[field]);
}
function hasField(value, field) {
    return isRecord(value) && field in value;
}
const styles = {
    card: {
        listStyle: 'none',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-primary)',
        overflow: 'hidden',
    },
    header: {
        appearance: 'none',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        border: 0,
        background: 'transparent',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
    },
    mark: {
        display: 'inline-flex',
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: 7,
        background: 'var(--dsw-alias-bg-module-platform)',
        color: 'var(--dsw-alias-state-warn-label)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
    },
    heading: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 },
    name: { fontSize: 15, lineHeight: 1.4, fontWeight: 600 },
    description: { fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
    badge: {
        flexShrink: 0,
        borderRadius: 999,
        padding: '1px 8px',
        background: 'var(--dsw-alias-bg-module-platform)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: '17px',
    },
    chevron: { flexShrink: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 18, lineHeight: 1 },
    body: { margin: '0 16px', borderTop: '1px solid var(--dsw-alias-border-l2)', padding: '4px 0 12px' },
    field: { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' },
    fieldHead: { display: 'flex', alignItems: 'center', gap: 8 },
    label: { minWidth: 0, flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
    smallBadge: {
        borderRadius: 999,
        padding: '1px 8px',
        background: 'var(--dsw-alias-bg-module-platform)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        lineHeight: '17px',
    },
    reset: {
        padding: 0,
        border: 0,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        lineHeight: 1.5,
    },
    input: {
        height: 34,
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        padding: '0 12px',
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 13,
        lineHeight: 1.5,
    },
    hint: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.5 },
    invalid: { margin: 0, color: 'var(--dsw-alias-label-error)', fontSize: 12, lineHeight: 1.5 },
    callout: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        marginTop: 12,
        padding: '10px 12px',
        borderLeft: '3px solid var(--dsw-alias-state-warn-label)',
        borderRadius: '0 8px 8px 0',
        background: 'var(--dsw-alias-bg-module-platform)',
    },
    calloutTitle: { fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
    link: { alignSelf: 'flex-start', color: 'var(--dsw-alias-brand-primary)', fontSize: 12, lineHeight: 1.5 },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 12, flexWrap: 'wrap' },
    failure: { flex: 1, margin: 0, color: 'var(--dsw-alias-label-error)', fontSize: 12, lineHeight: 1.5 },
    button: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        padding: '5px 14px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        lineHeight: 1.5,
    },
    save: {
        appearance: 'none',
        border: '1px solid transparent',
        borderRadius: 8,
        padding: '5px 14px',
        background: 'var(--dsw-alias-label-primary)',
        color: 'var(--dsw-alias-bg-layer-3)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        lineHeight: 1.5,
    },
    authStatus: {
        margin: 0,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        lineHeight: 1.5,
    },
    authIdentity: {
        margin: 0,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 12,
        lineHeight: 1.5,
    },
    authActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    authCode: {
        display: 'inline-flex',
        alignSelf: 'flex-start',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        padding: '5px 8px',
        background: 'var(--dsw-alias-bg-layer-3)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        letterSpacing: '0.06em',
    },
};
function useSettingsSnapshot(scope) {
    const subscribe = useCallback((listener) => scope.subscribe(listener), [scope]);
    const getSnapshot = useCallback(() => scope.getSnapshot(), [scope]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function Field(props) {
    return (_jsxs("label", { style: styles.field, children: [_jsxs("span", { style: styles.fieldHead, children: [_jsx("span", { style: styles.label, children: props.label }), props.override ? _jsx("span", { style: styles.smallBadge, children: props.t('overridden') }) : null, props.override ? (_jsx("button", { type: "button", style: styles.reset, disabled: props.disabled, onClick: props.onReset, children: props.t('reset') })) : null] }), props.isSelect ? (_jsxs("select", { "aria-label": props.label, style: styles.input, value: props.value, disabled: props.disabled, onChange: event => props.onChange(event.target.value), children: [_jsx("option", { value: "", children: props.t('kiroDefault') }), KIRO_REASONING_EFFORTS.map(effort => _jsx("option", { value: effort.id, children: effort.name }, effort.id))] })) : (_jsx("input", { "aria-label": props.label, style: { ...styles.input, ...(props.invalid ? { borderColor: 'var(--dsw-alias-label-error)' } : {}) }, value: props.value, disabled: props.disabled, onChange: event => props.onChange(event.target.value) })), props.invalid ? _jsx("p", { style: styles.invalid, children: props.t('required') }) : _jsx("p", { style: styles.hint, children: props.hint })] }));
}
function authenticationLabel(status, t) {
    if (status === undefined)
        return t('authLoading');
    if (status.login.state === 'waiting')
        return t('authWaiting');
    if (status.state === 'authenticated')
        return t('authConnected');
    if (status.login.state === 'complete')
        return t('authComplete');
    if (status.login.state === 'failed')
        return t('authFailed');
    if (status.login.state === 'cancelled')
        return t('authCancelled');
    if (status.login.state === 'expired')
        return t('authExpired');
    if (status.state === 'signed-out')
        return t('authSignedOut');
    return t('authUnavailable');
}
function KiroAuthenticationPanel(props) {
    const [status, setStatus] = useState();
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const request = useCallback(async (action) => {
        setLoading(true);
        setFailed(false);
        try {
            const next = action === 'status'
                ? await props.authentication.status()
                : action === 'enterprise-login'
                    ? await props.authentication.startEnterpriseLogin()
                    : await props.authentication.cancelLogin();
            setStatus(next);
        }
        catch {
            setFailed(true);
        }
        finally {
            setLoading(false);
        }
    }, [props.authentication]);
    useEffect(() => {
        if (!props.available)
            return;
        void request('status');
    }, [props.available, request]);
    const waiting = status?.login.state === 'waiting';
    useEffect(() => {
        if (!props.available || !waiting)
            return;
        const timer = window.setInterval(() => { void request('status'); }, 1_500);
        return () => window.clearInterval(timer);
    }, [props.available, request, waiting]);
    const identity = [status?.identity?.email, status?.identity?.accountType].filter((value) => value !== undefined).join(' · ');
    const canStart = props.available && !props.disabled && !loading && !waiting;
    const device = status?.login;
    return (_jsxs("div", { style: styles.callout, children: [_jsx("span", { style: styles.calloutTitle, children: props.t('authTitle') }), _jsx("p", { style: styles.hint, children: props.t('authBody') }), props.available ? _jsx("p", { role: "status", style: styles.authStatus, children: authenticationLabel(status, props.t) }) : _jsx("p", { style: styles.authStatus, children: props.t('authLocalOnly') }), identity.length > 0 ? _jsx("p", { style: styles.authIdentity, children: identity }) : null, props.available && waiting ? (_jsxs(_Fragment, { children: [device?.code === undefined ? _jsx("p", { style: styles.hint, children: props.t('authPreparing') }) : _jsx("code", { style: styles.authCode, children: device.code }), device?.url === undefined ? null : _jsx("a", { style: styles.link, href: device.url, target: "_blank", rel: "noreferrer", children: props.t('authOpenBrowser') }), _jsx("p", { style: styles.hint, children: props.t('authDeviceHint') })] })) : null, props.available && props.disabled ? _jsx("p", { style: styles.hint, children: props.t('authSaveFirst') }) : null, failed ? _jsx("p", { role: "status", style: styles.failure, children: props.t('authRequestFailed') }) : null, props.available ? _jsxs("div", { style: styles.authActions, children: [waiting ? (_jsx("button", { type: "button", style: styles.button, disabled: loading, onClick: () => { void request('cancel-login'); }, children: props.t('authCancel') })) : (_jsx("button", { type: "button", style: styles.save, disabled: !canStart, onClick: () => { void request('enterprise-login'); }, children: status?.state === 'authenticated' ? props.t('authRelogin') : props.t('authEnterpriseLogin') })), _jsx("button", { type: "button", style: styles.button, disabled: loading, onClick: () => { void request('status'); }, children: props.t('authRefresh') })] }) : null] }));
}
function KiroSettingsCardBody({ scope, t, authentication, canManageAuthentication }) {
    const snapshot = useSettingsSnapshot(scope);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => toDraft(undefined));
    const [baseline, setBaseline] = useState(() => toDraft(undefined));
    const [resets, setResets] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (snapshot.status !== 'ready')
            return;
        const next = toDraft(snapshot.value);
        setDraft(next);
        setBaseline(next);
        setResets(new Set());
        setFailed(false);
    }, [snapshot.status, snapshot.revision, snapshot.value]);
    if (snapshot.status === 'unavailable')
        return null;
    const overrides = Object.fromEntries(FIELDS.map(field => [field, hasField(snapshot.user, field)]));
    const invalid = draft.command.trim().length === 0 || draft.apiKeyEnv.trim().length === 0;
    const dirty = resets.size > 0 || !sameDraft(draft, baseline);
    const disabled = snapshot.status !== 'ready' || !snapshot.writable || saving;
    const edit = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setResets(current => {
            if (!current.has(field))
                return current;
            const next = new Set(current);
            next.delete(field);
            return next;
        });
        setFailed(false);
    };
    const reset = (field) => {
        const base = toDraft(isRecord(snapshot.base) ? snapshot.base : undefined);
        setDraft(current => ({ ...current, [field]: base[field] }));
        setResets(current => new Set(current).add(field));
        setFailed(false);
    };
    const discard = () => {
        setDraft(baseline);
        setResets(new Set());
        setFailed(false);
    };
    const save = async () => {
        if (!dirty || invalid || disabled)
            return;
        setSaving(true);
        setFailed(false);
        try {
            for (const field of FIELDS) {
                if (resets.has(field) || ((field === 'cwd' || field === 'defaultEffort') && draft[field] === '')) {
                    await scope.unset(field);
                }
                else if (draft[field] !== baseline[field]) {
                    await scope.set(field, draft[field].trim());
                }
            }
            const accepted = toDraft(scope.getSnapshot().value);
            setDraft(accepted);
            setBaseline(accepted);
            setResets(new Set());
        }
        catch {
            setFailed(true);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("li", { style: styles.card, children: [_jsxs("button", { type: "button", style: styles.header, "aria-expanded": open, "aria-label": `${t(open ? 'collapse' : 'expand')}: ${t('title')}`, onClick: () => setOpen(current => !current), children: [_jsx("span", { style: styles.mark, children: "ACP" }), _jsxs("span", { style: styles.heading, children: [_jsx("span", { style: styles.name, children: t('title') }), _jsx("span", { style: styles.description, children: snapshot.status === 'loading' ? t('loading') : t('description') })] }), dirty ? _jsx("span", { style: styles.badge, children: t('unsaved') }) : null, _jsx("span", { style: styles.chevron, children: open ? '⌃' : '⌄' })] }), open ? (_jsxs("div", { style: styles.body, children: [!snapshot.writable ? _jsx("p", { style: styles.hint, children: t('readOnly') }) : null, _jsx(Field, { field: "command", label: t('command'), hint: t('commandHint'), value: draft.command, override: overrides.command, invalid: draft.command.trim().length === 0, disabled: disabled, t: t, onChange: value => edit('command', value), onReset: () => reset('command') }), _jsx(Field, { field: "cwd", label: t('cwd'), hint: t('cwdHint'), value: draft.cwd, override: overrides.cwd, invalid: false, disabled: disabled, t: t, onChange: value => edit('cwd', value), onReset: () => reset('cwd') }), _jsx(Field, { field: "apiKeyEnv", label: t('apiKeyEnv'), hint: t('apiKeyEnvHint'), value: draft.apiKeyEnv, override: overrides.apiKeyEnv, invalid: draft.apiKeyEnv.trim().length === 0, disabled: disabled, t: t, onChange: value => edit('apiKeyEnv', value), onReset: () => reset('apiKeyEnv') }), _jsx(Field, { field: "defaultEffort", label: t('defaultEffort'), hint: t('defaultEffortHint'), value: draft.defaultEffort, override: overrides.defaultEffort, invalid: false, disabled: disabled, isSelect: true, t: t, onChange: value => edit('defaultEffort', value), onReset: () => reset('defaultEffort') }), _jsx(KiroAuthenticationPanel, { authentication: authentication, available: canManageAuthentication, disabled: dirty || snapshot.status !== 'ready', t: t }), _jsxs("div", { style: styles.callout, children: [_jsx("span", { style: styles.calloutTitle, children: t('cacheTitle') }), _jsx("p", { style: styles.hint, children: t('cacheBody') })] }), _jsxs("div", { style: styles.callout, children: [_jsx("span", { style: styles.calloutTitle, children: t('quotaTitle') }), _jsx("p", { style: styles.hint, children: t('quotaBody') }), _jsx("a", { style: styles.link, href: QUOTA_HELP_URL, target: "_blank", rel: "noreferrer", children: t('quotaLink') })] }), _jsxs("div", { style: styles.footer, children: [failed ? _jsx("p", { role: "status", style: styles.failure, children: t('saveFailed') }) : null, _jsx("button", { type: "button", style: styles.button, disabled: !dirty || saving, onClick: discard, children: t('discard') }), _jsx("button", { type: "button", style: styles.save, disabled: !dirty || invalid || disabled, onClick: () => { void save(); }, children: t(saving ? 'saving' : 'save') })] })] })) : null] }));
}
export function KiroSettingsCard(props) {
    if (props.scope === undefined || props.t === undefined || props.authentication === undefined || props.canManageAuthentication === undefined)
        return null;
    return _jsx(KiroSettingsCardBody, { scope: props.scope, t: props.t, authentication: props.authentication, canManageAuthentication: props.canManageAuthentication });
}
