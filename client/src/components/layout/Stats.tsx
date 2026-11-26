import { useCallback, useEffect, useState } from 'react';
import { fetchMonitor } from '../../api';
import type { MonitorResponse } from '../../types';
import { autoRefreshMs } from '../../constants';
import { onRefresh } from '../../refresh';
import Clock from '../widgets/Clock';
import { useSettings } from '../../state/hooks';
import { SettingsContext } from '../../state/SettingsContext';
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

/** The site's origin (protocol + host), e.g. "https://example.com". */
function originOf(url: string): string {
  try {
    const u = new URL(url);
    return u.origin || url;
  } catch {
    return url;
  }
}

/**
 * Website favicon with a fallback chain: load the site's own /favicon.ico
 * first (more reliable for custom domains), then fall back to Google's
 * favicon service, then hide the image entirely.
 */
function SiteIcon({ url }: { url: string }) {
  const origin = originOf(url);
  const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    hostOf(url)
  )}&sz=64`;
  const [src, setSrc] = useState(`${origin}/favicon.ico`);

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      width={20}
      height={20}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
        else setSrc('');
      }}
      style={src === '' ? { display: 'none' } : undefined}
    />
  );
}

/**
 * Trend arrow + percent change for a value compared to the previous reading.
 * Higher → green up arrow, lower → red down arrow. Renders nothing when
 * there is no comparable delta (e.g. first reading, or balance).
 */
function TrendArrow({
  delta,
  percent,
}: {
  delta: number | undefined;
  percent?: number | null;
}) {
  if (delta === undefined || delta === 0) return null;
  const up = delta > 0;
  const pctText =
    percent === null || percent === undefined
      ? null
      : `${percent > 0 ? '+' : ''}${percent.toFixed(0)} %`;
  return (
    <span className={styles.trendArrow}>
      <span
        className={`${styles.trendIcon} ${up ? styles.trendUp : styles.trendDown}`}
        aria-hidden="true"
      >
        {up ? '▲' : '▼'}
      </span>
      {pctText !== null && (
        <span
          className={`${styles.trendPct} ${up ? styles.trendUp : styles.trendDown}`}
        >
          {pctText}
        </span>
      )}
    </span>
  );
}

export default function Stats() {
  const { settings } = useSettings();
  const refreshMs = autoRefreshMs(settings);
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
    let id: number | undefined;
    if (refreshMs !== null) {
      id = window.setInterval(() => void load(), refreshMs);
    }
    const unsub = onRefresh(() => void load());
    return () => {
      if (id !== undefined) window.clearInterval(id);
      unsub();
    };
  }, [load, refreshMs]);

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
      <SettingsContext.Provider value={{ settings }}>
      {error && (
        <div className={styles.errorBanner}>Fehler beim Laden: {error}</div>
      )}

      <div className={styles.grid}>
        <div className={styles.leftColumn}>
          {/* Uhr oben links, halbe Seite wie im Dashboard */}
          <div className={styles.statsClock}>
            <Clock />
          </div>

          {/* Webseiten-Erreichbarkeit, halbe Seite, direkt unter der Uhr */}
          <section className={`${styles.card} ${styles.cardWebsites}`}>
            <div className={styles.cardHeader}>
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
              <>
                <ul className={styles.websiteList}>
                  {websites.map((w) => (
                    <li
                      key={w.url}
                      className={styles.websiteRow}
                      data-reachable={w.reachable}
                    >
                      <span className={styles.websiteIcon}>
                        <SiteIcon url={w.url} />
                      </span>
                      <span className={styles.websiteInfo}>
                        <span className={styles.websiteTitle}>
                          {w.title || hostOf(w.url)}
                        </span>
                        <span className={styles.websiteUrl}>{hostOf(w.url)}</span>
                      </span>
                      <span className={styles.websiteLatency}>
                        {formatLatency(w.latencyMs)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Overall status of all monitored services. */}
                <div
                  className={styles.overallStatus}
                  data-status={
                    websites.length - reachableCount === 0
                      ? 'ok'
                      : websites.length - reachableCount === 1
                        ? 'warn'
                        : 'bad'
                  }
                >
                  <span className={styles.overallDot} aria-hidden="true" />
                  <span className={styles.overallText}>
                    {websites.length - reachableCount === 0
                      ? 'Alle Dienste erreichbar'
                      : `${websites.length - reachableCount} ${
                          websites.length - reachableCount === 1
                            ? 'Dienst nicht erreichbar'
                            : 'Dienste nicht erreichbar'
                        }`}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>

        <div className={styles.rightColumn}>
          {/* EdenAI stats (rechts neben der Uhr) */}
          <section className={`${styles.card} ${styles.cardEdenai}`}>
            <div className={styles.cardHeader}>
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
                      <TrendArrow delta={usage.usageDelta} percent={usage.usagePercent} />
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
                      <TrendArrow delta={usage.callsDelta} percent={usage.callsPercent} />
                    </span>
                    <span className={styles.balanceLabel}>
                      Calls · letzte {edenaiDisplay.periodDays} Tage
                    </span>
                  </div>
                )}
            </div>
          )}
          </section>
        </div>
      </div>
      </SettingsContext.Provider>
    </div>
  );
}
