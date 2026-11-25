import { useCallback, useEffect, useState } from 'react';
import { fetchMonitor } from '../../api';
import type { MonitorResponse } from '../../types';
import { REFRESH } from '../../constants';
import { onRefresh } from '../../refresh';
import styles from './Stats.module.css';

/** Format a balance with its currency, e.g. "12.34 USD". */
function formatBalance(balance: number | null, currency?: string): string {
  if (balance === null) return '–';
  const currencyCode = currency && currency !== 'USD' ? currency : 'USD';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance) + ` ${currencyCode}`;
}

/** Format a latency in ms, e.g. "123 ms". */
function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–';
  return `${Math.round(ms)} ms`;
}

/** Strip the protocol for display, e.g. "https://example.com" → "example.com". */
function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url;
  }
}

export default function Stats() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchMonitor();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH.monitorMs);
    const unsub = onRefresh(() => void load());
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [load]);

  const edenai = data?.edenai;
  const websites = data?.websites ?? [];
  const reachableCount = websites.filter((w) => w.reachable).length;

  // EdenAI display configuration (defaults if not present).
  const edenaiDisplay = edenai?.display ?? { values: ['balance'], periodDays: 30 };
  const balance = edenai?.balanceData ?? null;
  const usage = edenai?.usageData ?? null;

  // EdenAI is "configured" if a management key is set and we have at least one value.
  const edenaiConfigured =
    (balance?.configured === true && !balance.error) ||
    (usage !== null && !usage.error);

  return (
    <div className={styles.page} data-scrollable>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Stats &amp; Status</h1>
        <p className={styles.pageSubtitle}>
          EdenAI-Daten und Erreichbarkeit deiner Webseiten
        </p>
      </header>

      {error && (
        <div className={styles.errorBanner}>Fehler beim Laden: {error}</div>
      )}

      <div className={styles.grid}>
        {/* EdenAI stats */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardDot} style={{ background: 'var(--accent)' }} />
            <h2 className={styles.cardTitle}>EdenAI</h2>
          </div>

          {loading && !data ? (
            <p className={styles.empty}>Lädt…</p>
          ) : !edenaiConfigured ? (
            <div className={styles.unconfigured}>
              <p className={styles.empty}>EdenAI ist nicht konfiguriert.</p>
              <p className={styles.hint}>
                Trage einen EdenAI-Key unter{' '}
                <strong>Einstellungen → Stats &amp; Monitoring</strong> ein.
              </p>
            </div>
          ) : (
            <div className={styles.balanceList}>
              {balance && balance.error && (
                <p className={styles.error}>{balance.error}</p>
              )}
              {usage && usage.error && (
                <p className={styles.error}>{usage.error}</p>
              )}

              {edenaiDisplay.values.includes('balance') &&
                balance?.configured === true &&
                !balance.error && (
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceValue}>
                      {formatBalance(balance.balance, balance.currency)}
                    </span>
                    <span className={styles.balanceLabel}>verfügbares Guthaben</span>
                  </div>
                )}

              {edenaiDisplay.values.includes('usage') &&
                usage?.usage !== undefined &&
                !usage.error && (
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceValue}>
                      {formatBalance(usage.usage, 'USD')}
                    </span>
                    <span className={styles.balanceLabel}>
                      Verbrauch · letzte {edenaiDisplay.periodDays} Tage
                    </span>
                  </div>
                )}

              {edenaiDisplay.values.includes('calls') &&
                usage?.calls !== undefined &&
                !usage.error && (
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceValue}>
                      {new Intl.NumberFormat('de-DE').format(usage.calls)}
                    </span>
                    <span className={styles.balanceLabel}>
                      Calls · letzte {edenaiDisplay.periodDays} Tage
                    </span>
                  </div>
                )}
            </div>
          )}
        </section>

        {/* Website reachability */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span
              className={styles.cardDot}
              style={{
                background:
                  websites.length > 0 && reachableCount === websites.length
                    ? 'var(--success)'
                    : 'var(--muted-strong)',
              }}
            />
            <h2 className={styles.cardTitle}>Webseiten-Erreichbarkeit</h2>
            {websites.length > 0 && (
              <span className={styles.cardMeta}>
                {reachableCount}/{websites.length} erreichbar
              </span>
            )}
          </div>

          {loading && !data ? (
            <p className={styles.empty}>Lädt…</p>
          ) : websites.length === 0 ? (
            <div className={styles.unconfigured}>
              <p className={styles.empty}>Keine Webseiten konfiguriert.</p>
              <p className={styles.hint}>
                Füge unter <strong>Einstellungen → Stats &amp; Monitoring</strong> URLs hinzu.
              </p>
            </div>
          ) : (
            <ul className={styles.websiteList}>
              {websites.map((w) => (
                <li key={w.url} className={styles.websiteRow}>
                  <span
                    className={styles.statusDot}
                    data-reachable={w.reachable}
                    aria-hidden="true"
                  />
                  <span className={styles.websiteHost}>{hostOf(w.url)}</span>
                  <span className={styles.websiteStatus}>
                    {w.reachable
                      ? `OK${w.status ? ` · ${w.status}` : ''}`
                      : w.error || 'Nicht erreichbar'}
                  </span>
                  <span className={styles.websiteLatency}>
                    {formatLatency(w.latencyMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data?.updatedAt && (
        <footer className={styles.pageFooter}>
          Zuletzt aktualisiert:{' '}
          {new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(new Date(data.updatedAt))}
        </footer>
      )}
    </div>
  );
}
