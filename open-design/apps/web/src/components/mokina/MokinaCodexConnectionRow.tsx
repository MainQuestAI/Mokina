import { useState } from 'react';

import { useT } from '../../i18n';
import type { Dict } from '../../i18n/types';

/**
 * T04: user-triggered Codex connection check inside the Codex agent card.
 *
 * Everything before the click is inert (no network); the check reads the
 * authoritative daemon probe (`codex login status` + CLI version + configured
 * model) and renders the state with a concrete next action. A failed or
 * unconfirmed probe never shows "connected".
 */

type ConnectionState =
  | 'ready'
  | 'cli_missing'
  | 'login_required'
  | 'permission_denied'
  | 'quota_or_billing'
  | 'network_unavailable'
  | 'model_unavailable'
  | 'unknown';

const STATE_LABEL_KEY: Record<ConnectionState, keyof Dict> = {
  ready: 'settings.mokinaConnection.state.ready',
  cli_missing: 'settings.mokinaConnection.state.cliMissing',
  login_required: 'settings.mokinaConnection.state.loginRequired',
  permission_denied: 'settings.mokinaConnection.state.permissionDenied',
  quota_or_billing: 'settings.mokinaConnection.state.quotaOrBilling',
  network_unavailable: 'settings.mokinaConnection.state.networkUnavailable',
  model_unavailable: 'settings.mokinaConnection.state.modelUnavailable',
  unknown: 'settings.mokinaConnection.state.unknown',
};

type ConnectionReport = {
  state: ConnectionState;
  checkedAt: string;
  cli: { resolved: boolean; version: string | null; source: string };
  auth: { state: 'logged-in' | 'logged-out' | 'unconfirmed'; methodLabel: string | null };
  model: { configuredModel: string | null; readable: boolean };
  nextAction: string;
};

export function MokinaCodexConnectionRow() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/mokina/codex-connection');
      if (!response.ok) throw new Error(`${t('settings.mokinaConnection.failed')} (${response.status})`);
      setReport(await response.json() as ConnectionReport);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : t('settings.mokinaConnection.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-card-diagnostic" data-testid="mokina-codex-connection">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ghost button-like" disabled={busy} onClick={() => void check()}>
          {busy ? t('settings.mokinaConnection.checking') : t('settings.mokinaConnection.check')}
        </button>
        {report ? (
          <span role="status" data-testid="mokina-codex-connection-state">
            {t(STATE_LABEL_KEY[report.state])}
            {report.cli.version ? ` · ${report.cli.version}` : ''}
            {report.auth.methodLabel ? ` · ${report.auth.methodLabel}` : ''}
            {report.model.configuredModel ? ` · ${report.model.configuredModel}` : ''}
          </span>
        ) : null}
      </div>
      {report ? (
        <p data-testid="mokina-codex-connection-next">{report.nextAction}</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
