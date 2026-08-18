import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { KIRO_REASONING_EFFORTS } from '../effort.js'
import type { Config as KiroConfig } from '../index.js'
import type { KiroSettingsKey } from './locales.js'

export type KiroSettings = Pick<KiroConfig, 'command' | 'cwd' | 'apiKeyEnv' | 'defaultEffort'>
type DraftField = keyof KiroSettings
type Draft = Record<DraftField, string>

const FIELDS: readonly DraftField[] = ['command', 'cwd', 'apiKeyEnv', 'defaultEffort']
const QUOTA_HELP_URL = 'https://kiro.dev/docs/cli/billing/subscription-portal/'

export interface KiroSettingsCardInjected {
  scope: SettingsScope<KiroSettings>
  t: (key: KiroSettingsKey) => string
}

export type KiroSettingsCardProps = Partial<KiroSettingsCardInjected>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toDraft(value: KiroSettings | undefined): Draft {
  return {
    command: stringValue(value?.command, 'kiro-cli'),
    cwd: stringValue(value?.cwd),
    apiKeyEnv: stringValue(value?.apiKeyEnv, 'KIRO_API_KEY'),
    defaultEffort: stringValue(value?.defaultEffort),
  }
}

function sameDraft(left: Draft, right: Draft): boolean {
  return FIELDS.every(field => left[field] === right[field])
}

function hasField(value: unknown, field: DraftField): boolean {
  return isRecord(value) && field in value
}

const styles: Record<string, CSSProperties> = {
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
}

function useSettingsSnapshot(scope: SettingsScope<KiroSettings>): SettingsScopeSnapshot<KiroSettings> {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope])
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function Field(props: {
  field: DraftField
  label: string
  hint: string
  value: string
  override: boolean
  invalid: boolean
  disabled: boolean
  isSelect?: boolean
  t: KiroSettingsCardInjected['t']
  onChange: (value: string) => void
  onReset: () => void
}): JSX.Element {
  return (
    <label style={styles.field}>
      <span style={styles.fieldHead}>
        <span style={styles.label}>{props.label}</span>
        {props.override ? <span style={styles.smallBadge}>{props.t('overridden')}</span> : null}
        {props.override ? (
          <button type="button" style={styles.reset} disabled={props.disabled} onClick={props.onReset}>
            {props.t('reset')}
          </button>
        ) : null}
      </span>
      {props.isSelect ? (
        <select
          aria-label={props.label}
          style={styles.input}
          value={props.value}
          disabled={props.disabled}
          onChange={event => props.onChange(event.target.value)}
        >
          <option value="">{props.t('kiroDefault')}</option>
          {KIRO_REASONING_EFFORTS.map(effort => <option key={effort.id} value={effort.id}>{effort.name}</option>)}
        </select>
      ) : (
        <input
          aria-label={props.label}
          style={{ ...styles.input, ...(props.invalid ? { borderColor: 'var(--dsw-alias-label-error)' } : {}) }}
          value={props.value}
          disabled={props.disabled}
          onChange={event => props.onChange(event.target.value)}
        />
      )}
      {props.invalid ? <p style={styles.invalid}>{props.t('required')}</p> : <p style={styles.hint}>{props.hint}</p>}
    </label>
  )
}

function KiroSettingsCardBody({ scope, t }: KiroSettingsCardInjected): JSX.Element | null {
  const snapshot = useSettingsSnapshot(scope)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(undefined))
  const [baseline, setBaseline] = useState<Draft>(() => toDraft(undefined))
  const [resets, setResets] = useState<ReadonlySet<DraftField>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (snapshot.status !== 'ready') return
    const next = toDraft(snapshot.value)
    setDraft(next)
    setBaseline(next)
    setResets(new Set())
    setFailed(false)
  }, [snapshot.status, snapshot.revision, snapshot.value])

  if (snapshot.status === 'unavailable') return null

  const overrides = Object.fromEntries(FIELDS.map(field => [field, hasField(snapshot.user, field)])) as Record<DraftField, boolean>
  const invalid = draft.command.trim().length === 0 || draft.cwd.trim().length === 0 || draft.apiKeyEnv.trim().length === 0
  const dirty = resets.size > 0 || !sameDraft(draft, baseline)
  const disabled = snapshot.status !== 'ready' || !snapshot.writable || saving

  const edit = (field: DraftField, value: string): void => {
    setDraft(current => ({ ...current, [field]: value }))
    setResets(current => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
    setFailed(false)
  }

  const reset = (field: DraftField): void => {
    const base = toDraft(isRecord(snapshot.base) ? snapshot.base as KiroSettings : undefined)
    setDraft(current => ({ ...current, [field]: base[field] }))
    setResets(current => new Set(current).add(field))
    setFailed(false)
  }

  const discard = (): void => {
    setDraft(baseline)
    setResets(new Set())
    setFailed(false)
  }

  const save = async (): Promise<void> => {
    if (!dirty || invalid || disabled) return
    setSaving(true)
    setFailed(false)
    try {
      for (const field of FIELDS) {
        if (resets.has(field) || (field === 'defaultEffort' && draft[field] === '')) {
          await scope.unset(field)
        } else if (draft[field] !== baseline[field]) {
          await scope.set(field, draft[field].trim())
        }
      }
      const accepted = toDraft(scope.getSnapshot().value)
      setDraft(accepted)
      setBaseline(accepted)
      setResets(new Set())
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li style={styles.card}>
      <button
        type="button"
        style={styles.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => setOpen(current => !current)}
      >
        <span style={styles.mark}>ACP</span>
        <span style={styles.heading}>
          <span style={styles.name}>{t('title')}</span>
          <span style={styles.description}>{snapshot.status === 'loading' ? t('loading') : t('description')}</span>
        </span>
        {dirty ? <span style={styles.badge}>{t('unsaved')}</span> : null}
        <span style={styles.chevron}>{open ? '⌃' : '⌄'}</span>
      </button>
      {open ? (
        <div style={styles.body}>
          {!snapshot.writable ? <p style={styles.hint}>{t('readOnly')}</p> : null}
          <Field field="command" label={t('command')} hint={t('commandHint')} value={draft.command} override={overrides.command} invalid={draft.command.trim().length === 0} disabled={disabled} t={t} onChange={value => edit('command', value)} onReset={() => reset('command')} />
          <Field field="cwd" label={t('cwd')} hint={t('cwdHint')} value={draft.cwd} override={overrides.cwd} invalid={draft.cwd.trim().length === 0} disabled={disabled} t={t} onChange={value => edit('cwd', value)} onReset={() => reset('cwd')} />
          <Field field="apiKeyEnv" label={t('apiKeyEnv')} hint={t('apiKeyEnvHint')} value={draft.apiKeyEnv} override={overrides.apiKeyEnv} invalid={draft.apiKeyEnv.trim().length === 0} disabled={disabled} t={t} onChange={value => edit('apiKeyEnv', value)} onReset={() => reset('apiKeyEnv')} />
          <Field field="defaultEffort" label={t('defaultEffort')} hint={t('defaultEffortHint')} value={draft.defaultEffort} override={overrides.defaultEffort} invalid={false} disabled={disabled} isSelect t={t} onChange={value => edit('defaultEffort', value)} onReset={() => reset('defaultEffort')} />
          <div style={styles.callout}>
            <span style={styles.calloutTitle}>{t('cacheTitle')}</span>
            <p style={styles.hint}>{t('cacheBody')}</p>
          </div>
          <div style={styles.callout}>
            <span style={styles.calloutTitle}>{t('quotaTitle')}</span>
            <p style={styles.hint}>{t('quotaBody')}</p>
            <a style={styles.link} href={QUOTA_HELP_URL} target="_blank" rel="noreferrer">{t('quotaLink')}</a>
          </div>
          <div style={styles.footer}>
            {failed ? <p role="status" style={styles.failure}>{t('saveFailed')}</p> : null}
            <button type="button" style={styles.button} disabled={!dirty || saving} onClick={discard}>{t('discard')}</button>
            <button type="button" style={styles.save} disabled={!dirty || invalid || disabled} onClick={() => { void save() }}>{t(saving ? 'saving' : 'save')}</button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function KiroSettingsCard(props: KiroSettingsCardProps): JSX.Element | null {
  if (props.scope === undefined || props.t === undefined) return null
  return <KiroSettingsCardBody scope={props.scope} t={props.t} />
}
