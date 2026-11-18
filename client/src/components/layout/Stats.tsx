import { useCallback, useEffect, useState } from 'react';
import { fetchMonitor } from '../../api';
import type { MonitorResponse } from '../../types';
import styles from './Stats.module.css';

const POLL_INTERVAL_MS = 60_000;

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
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const edenai = data?.edenai;
  const websites = data?.websites ?? [];
  const reachableCount = websites.filter((w) => w.reachable).length;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Stats &amp; Status</h1>
        <p className={styles.pageSubtitle}>
          EdenAI-Guthaben und Erreichbarkeit deiner Webseiten
        </p>
      </header>

      {error && (
        <div className={styles.errorBanner}>Fehler beim Laden: {error}</div>
      )}

      <div className={styles.grid}>
        {/* EdenAI credit balance */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardDot} style={{ background: 'var(--accent)' }} />
            <h2 className={styles.cardTitle}>EdenAI Guthaben</h2>
          </div>

          {loading && !data ? (
            <p className={styles.empty}>Lädt…</p>
          ) : !edenai || !edenai.configured ? (
            <div className={styles.unconfigured}>
              <p className={styles.empty}>
                EdenAI ist nicht konfiguriert.
              </p>
              <p className={styles.hint}>
                Trage <code>EDENAI_MANAGEMENT_KEY</code> in die{' '}
                <code>server/.env</code> ein.
              </p>
            </div>
          ) : edenai.error ? (
            <p className={styles.error}>{edenai.error}</p>
          ) : (
            <div className={styles.balance}>
              <span className={styles.balanceValue}>
                {formatBalance(edenai.balance, edenai.currency)}
              </span>
              <span className={styles.balanceLabel}>verfügbares Guthaben</span>
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
                Trage URLs (kommagetrennt) in <code>MONITOR_URLS</code> in die{' '}
                <code>server/.env</code> ein.
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
