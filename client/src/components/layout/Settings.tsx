import { useCallback, useEffect, useRef, useState } from 'react';
import {
  disconnectProvider,
  fetchAuthStatus,
  OAUTH_START,
} from '../../api';
import { useSettings, useWidgets } from '../../state/hooks';
import { triggerRefresh } from '../../refresh';
import { widgetIds } from '../widgets';
import type { AuthStatus, ProviderStatus, Widget, WidgetConfig } from '../../types';
import styles from './Settings.module.css';

interface Message {
  type: 'success' | 'error';
  text: string;
}

const ACCENT_PRESETS = ['#e8862a', '#f59e0b', '#ef4444', '#a855f7', '#22c55e', '#3b82f6'];

/** Derive a display title from a URL host, e.g. "https://example.com" → "Example". */
function titleFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host
      .split('.')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return url;
  }
}

/**
 * Convert the stored monitor list (array of {title, url} objects, possibly
 * legacy plain strings) into the textarea format "Titel | URL" (one per line).
 */
function monitorToText(entries: unknown): string {
  if (!Array.isArray(entries)) return '';
  return entries
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        const title = String((entry as { title?: string }).title || '').trim();
        const url = String((entry as { url?: string }).url || '').trim();
        if (!url) return '';
        return title ? `${title} | ${url}` : url;
      }
      return String(entry || '').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/** Convert the textarea content ("Titel | URL" or just "URL" per line) into
 *  the stored format: an array of {title, url} objects. */
function textToMonitor(text: string): { title: string; url: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|');
      if (pipe !== -1) {
        const title = line.slice(0, pipe).trim();
        const url = line.slice(pipe + 1).trim();
        if (url) return { title: title || titleFromUrl(url), url };
      }
      return { title: titleFromUrl(line), url: line };
    })
    .filter((entry) => entry.url);
}

/** Sections shown in the side navigation, in order. */
const SECTIONS = [
  { id: 'kalender', label: 'Kalender' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'daten', label: 'Daten' },
  { id: 'stats-monitoring', label: 'Stats & Monitoring' },
];

/** Scroll the settings page to a section by id. */
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function providerStatusLabel(status: ProviderStatus): { label: string; cls: string } {
  if (status.connected) {
    return { label: 'Verbunden', cls: styles.statusConnected };
  }
  if (status.configured) {
    return { label: 'Konfiguriert', cls: styles.statusConfigured };
  }
  return { label: 'Nicht konfiguriert', cls: styles.statusNotConnected };
}

export default function Settings() {
  const { settings, save: saveSettings, loading } = useSettings();
  const { widgets, saveWidget } = useWidgets();

  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [edenaiKey, setEdenaiKey] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [edenaiValues, setEdenaiValues] = useState<string[]>([]);
  const [periodDays, setPeriodDays] = useState(30);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(60);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [autoRotateSeconds, setAutoRotateSeconds] = useState(30);

  const showMessage = useCallback((type: Message['type'], text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

  // Ensure the form state is initialized from the saved settings exactly once
  // (after the settings have loaded). Guarding with a ref prevents this effect
  // from re-running on unrelated changes (e.g. editing the URLs textarea or
  // toggling an EdenAI value), which would silently discard unsaved selections
  // such as the auto-rotate interval.
  const initializedRef = useRef(false);

  const loadAuth = useCallback(async () => {
    try {
      setAuth(await fetchAuthStatus());
    } catch (err) {
      console.error('Auth-Status laden fehlgeschlagen:', err);
    }
  }, []);

  useEffect(() => {
    void loadAuth();
    // Handle ?connected=... query param after OAuth callback.
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected === 'google') {
      showMessage('success', 'Google erfolgreich verbunden!');
      // Clean up the query string without triggering a reload.
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      void loadAuth();
    }
  }, [loadAuth, showMessage]);

  // Initialize the form from the loaded settings (once, after they arrive).
  useEffect(() => {
    if (initializedRef.current || loading) return;
    initializedRef.current = true;
    if (settings.monitor_urls?.length) {
      setUrlsText(monitorToText(settings.monitor_urls));
    }
    if (settings.edenai_display) {
      setEdenaiValues(settings.edenai_display.values);
      setPeriodDays(settings.edenai_display.periodDays || 30);
    }
    if (settings.auto_refresh_enabled !== undefined) {
      setAutoRefreshEnabled(settings.auto_refresh_enabled);
    }
    if (settings.auto_refresh_seconds !== undefined) {
      setAutoRefreshSeconds(settings.auto_refresh_seconds);
    }
    if (settings.auto_rotate_enabled !== undefined) {
      setAutoRotateEnabled(settings.auto_rotate_enabled);
    }
    if (settings.auto_rotate_seconds !== undefined) {
      setAutoRotateSeconds(settings.auto_rotate_seconds);
    }
  }, [settings, loading]);

  // Track whether there are unsaved changes in the monitoring fields.
  const originalUrls = monitorToText(settings.monitor_urls).trim();
  const originalEdenaiValues = settings.edenai_display?.values?.slice().sort() ?? [];
  const originalPeriod = settings.edenai_display?.periodDays ?? 30;
  const edenaiChanged =
    edenaiValues.slice().sort().join(',') !== originalEdenaiValues.join(',') ||
    periodDays !== originalPeriod;
  const hasUnsaved =
    edenaiKey.trim() !== '' || urlsText.trim() !== originalUrls || edenaiChanged ||
    autoRefreshEnabled !== (settings.auto_refresh_enabled === true) ||
    autoRefreshSeconds !== (settings.auto_refresh_seconds ?? 60) ||
    autoRotateEnabled !== (settings.auto_rotate_enabled === true) ||
    autoRotateSeconds !== (settings.auto_rotate_seconds ?? 30);

  const handleSaveMonitoring = async () => {
    try {
      const patch: Record<string, unknown> = {};
      // Only send a new EdenAI key if the user typed one (avoid overwriting with empty).
      if (edenaiKey.trim()) patch.edenai_key = edenaiKey.trim();
      // Normalize the URLs textarea into the stored {title, url} format.
      patch.monitor_urls = textToMonitor(urlsText);
      // EdenAI display configuration.
      patch.edenai_display = { values: edenaiValues, periodDays };
      // Auto refresh / rotate configuration.
      patch.auto_refresh_enabled = autoRefreshEnabled;
      patch.auto_refresh_seconds = autoRefreshSeconds;
      patch.auto_rotate_enabled = autoRotateEnabled;
      patch.auto_rotate_seconds = autoRotateSeconds;
      await saveSettings(patch as never);
      setEdenaiKey('');
      showMessage('success', 'Einstellungen gespeichert.');
      // Reload all data-driven views (calendar, Vikunja, stats) so the
      // changes (monitored sites, intervals, …) are applied immediately.
      triggerRefresh();
    } catch (err) {
      showMessage('error', `Speichern fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const toggleEdenaiValue = (value: string) => {
    setEdenaiValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleDisconnect = async (provider: 'google') => {
    try {
      await disconnectProvider(provider);
      showMessage('success', 'Google getrennt.');
      void loadAuth();
    } catch (err) {
      showMessage('error', `Trennen fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleWidgetToggle = async (widget: Widget, enabled: boolean) => {
    try {
      await saveWidget(widget.id, { enabled });
      showMessage('success', `Widget "${widget.id}" ${enabled ? 'aktiviert' : 'deaktiviert'}.`);
      triggerRefresh();
    } catch (err) {
      showMessage('error', `Aktualisieren fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleWidgetConfig = async (widget: Widget, config: WidgetConfig) => {
    try {
      await saveWidget(widget.id, { config });
      showMessage('success', 'Widget konfiguriert.');
      triggerRefresh();
    } catch (err) {
      showMessage('error', `Konfiguration fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const renderWidgetOptions = (widget: Widget) => {
    if (widget.id === 'clock') {
      const showSeconds = widget.config?.showSeconds === true;
      return (
        <div className={styles.widgetOptions}>
          <div className={styles.optionRow}>
            <span className={styles.optionLabel}>Sekunden anzeigen</span>
            <div className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showSeconds}
                onChange={(e) =>
                  handleWidgetConfig(widget, { ...widget.config, showSeconds: e.target.checked })
                }
              />
              <span className={styles.toggleTrack} />
              <span className={styles.toggleThumb} />
            </div>
          </div>
        </div>
      );
    }

    if (widget.id === 'calendar') {
      const maxEvents = Number(widget.config?.maxEvents) || 8;
      return (
        <div className={styles.widgetOptions}>
          <div className={styles.optionRow}>
            <span className={styles.optionLabel}>Maximale Termine</span>
            <input
              type="number"
              min={1}
              max={30}
              className={styles.select}
              style={{ width: 90 }}
              value={maxEvents}
              onChange={(e) => {
                const value = Math.max(1, Number(e.target.value) || 1);
                handleWidgetConfig(widget, { ...widget.config, maxEvents: value });
              }}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  const handleThemeChange = async (theme: 'dark' | 'light') => {
    try {
      await saveSettings({ theme });
    } catch (err) {
      showMessage('error', `Theme konnte nicht gespeichert werden: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleAccentChange = async (accent: string) => {
    try {
      await saveSettings({ accent });
    } catch (err) {
      showMessage('error', `Akzentfarbe konnte nicht gespeichert werden: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const googleStatus = auth ? providerStatusLabel(auth.google) : null;
  const theme = settings.theme === 'light' ? 'light' : 'dark';

  return (
    <div className={styles.page} data-scrollable>
      <div className={styles.header}>
        <h1 className={styles.title}>Einstellungen</h1>
      </div>

      {/* Toast notification, top-right */}
      {message && (
        <div
          className={`${styles.toast} ${
            message.type === 'success' ? styles.toastSuccess : styles.toastError
          }`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.toastIcon}>
            {message.type === 'success' ? '✓' : '✕'}
          </span>
          {message.text}
        </div>
      )}

      {/* Kalender */}
      <div className={styles.layout}>
        <div className={styles.main}>
        <section id="kalender" className={styles.section}>
          <h2 className={styles.sectionTitle}>Kalender</h2>
        <p className={styles.sectionHint}>
          Verbinde Google, um deine Termine im Dashboard anzuzeigen.
        </p>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Google Kalender</span>
          <div className={styles.rowActions}>
            {googleStatus && (
              <span className={`${styles.statusBadge} ${googleStatus.cls}`}>
                <span className={styles.statusDot} />
                {googleStatus.label}
              </span>
            )}
            {auth?.google.connected ? (
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => handleDisconnect('google')}
              >
                Trennen
              </button>
            ) : (
              <a
                className={`${styles.button} ${styles.buttonGoogle}`}
                href={OAUTH_START.google}
                style={{ textDecoration: 'none' }}
              >
                Mit Google verbinden
              </a>
            )}
          </div>
        </div>

        <div className={styles.notice}>
          Hinweis: Für die OAuth-Verbindung müssen die Zugangsdaten (Client-ID und Secret) in der{' '}
          <code>.env</code> des Servers konfiguriert werden.
        </div>
        </section>

      {/* Widgets */}
      <section id="widgets" className={styles.section}>
        <h2 className={styles.sectionTitle}>Widgets</h2>
        <p className={styles.sectionHint}>
          Aktiviere oder deaktiviere Widgets und passe sie an.
        </p>

        {widgetIds.map((id) => {
          const widget = widgets.find((w) => w.id === id);
          if (!widget) return null;
          return (
            <div key={id} className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <span className={styles.widgetName}>{id}</span>
                <div className={styles.toggle}>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={widget.enabled}
                    onChange={(e) => handleWidgetToggle(widget, e.target.checked)}
                  />
                  <span className={styles.toggleTrack} />
                  <span className={styles.toggleThumb} />
                </div>
              </div>
              {widget.enabled && renderWidgetOptions(widget)}
            </div>
          );
        })}
      </section>

      {/* Darstellung */}
      <section id="darstellung" className={styles.section}>
        <h2 className={styles.sectionTitle}>Darstellung</h2>
        <p className={styles.sectionHint}>Passe das Aussehen des Dashboards an.</p>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Theme</span>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={`${styles.button} ${
                theme === 'dark' ? '' : styles.buttonSecondary
              }`}
              onClick={() => handleThemeChange('dark')}
            >
              Dunkel
            </button>
            <button
              type="button"
              className={`${styles.button} ${
                theme === 'light' ? '' : styles.buttonSecondary
              }`}
              onClick={() => handleThemeChange('light')}
            >
              Hell
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Akzentfarbe</span>
          <div className={styles.rowActions}>
            <div className={styles.presets}>
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.preset} ${
                    settings.accent === color ? styles.presetActive : ''
                  }`}
                  style={{ background: color }}
                  onClick={() => handleAccentChange(color)}
                  aria-label={`Akzentfarbe ${color}`}
                />
              ))}
            </div>
            <input
              type="color"
              className={styles.colorInput}
              value={settings.accent || '#3b82f6'}
              onChange={(e) => handleAccentChange(e.target.value)}
              aria-label="Benutzerdefinierte Akzentfarbe"
            />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>24-Stunden-Format</span>
          <div className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={settings.clock_24h !== false}
              onChange={(e) => saveSettings({ clock_24h: e.target.checked })}
            />
            <span className={styles.toggleTrack} />
            <span className={styles.toggleThumb} />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Sekunden anzeigen</span>
          <div className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={settings.clock_seconds === true}
              onChange={(e) => saveSettings({ clock_seconds: e.target.checked })}
            />
            <span className={styles.toggleTrack} />
            <span className={styles.toggleThumb} />
          </div>
        </div>
      </section>

      {/* Daten */}
      <section id="daten" className={styles.section}>
        <h2 className={styles.sectionTitle}>Daten</h2>
        <p className={styles.sectionHint}>
          Automatisches Aktualisieren und Wechseln der Ansichten.
        </p>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>Automatisch aktualisieren</span>
            <span className={styles.rowHint}>
              Daten (Tasks, Kalender, Stats) regelmäßig neu laden
            </span>
          </div>
          <div className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            <span className={styles.toggleTrack} />
            <span className={styles.toggleThumb} />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Aktualisieren alle</span>
          <select
            className={styles.select}
            style={{ minWidth: 180 }}
            value={autoRefreshSeconds}
            onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
            disabled={!autoRefreshEnabled}
          >
            <option value={15}>15 Sekunden</option>
            <option value={30}>30 Sekunden</option>
            <option value={60}>1 Minute</option>
            <option value={120}>2 Minuten</option>
            <option value={300}>5 Minuten</option>
          </select>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>Automatisch wechseln</span>
            <span className={styles.rowHint}>
              Zwischen Dashboard und Stats umschalten
            </span>
          </div>
          <div className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoRotateEnabled}
              onChange={(e) => setAutoRotateEnabled(e.target.checked)}
            />
            <span className={styles.toggleTrack} />
            <span className={styles.toggleThumb} />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Wechseln alle</span>
          <select
            className={styles.select}
            style={{ minWidth: 180 }}
            value={autoRotateSeconds}
            onChange={(e) => setAutoRotateSeconds(Number(e.target.value))}
            disabled={!autoRotateEnabled}
          >
            <option value={15}>15 Sekunden</option>
            <option value={30}>30 Sekunden</option>
            <option value={60}>1 Minute</option>
            <option value={120}>2 Minuten</option>
            <option value={300}>5 Minuten</option>
          </select>
        </div>
      </section>

      {/* Stats & Monitoring */}
      <section id="stats-monitoring" className={styles.section}>
        <h2 className={styles.sectionTitle}>Stats &amp; Monitoring</h2>
        <p className={styles.sectionHint}>
          Konfiguriere den Stats-Reiter: EdenAI-Daten und überwachte Webseiten.
        </p>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="edenai-key">
            EdenAI API-Key
          </label>
          {settings.edenai_key && (
            <div className={styles.hint}>Aktueller Key: {settings.edenai_key}</div>
          )}
          <input
            id="edenai-key"
            type="password"
            className={styles.textInput}
            placeholder={
              settings.edenai_key
                ? 'Neuen Key eingeben (bestehender bleibt erhalten)'
                : 'mgmt-eden-…'
            }
            value={edenaiKey}
            onChange={(e) => setEdenaiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>EdenAI-Anzeige-Werte</label>
          <div className={styles.hint}>
            Wähle, welche Werte im Stats-Reiter angezeigt werden und über welchen Zeitraum.
          </div>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={edenaiValues.includes('balance')}
                onChange={() => toggleEdenaiValue('balance')}
              />
              Aktuelles Guthaben
            </label>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={edenaiValues.includes('usage')}
                onChange={() => toggleEdenaiValue('usage')}
              />
              Verbrauch (Kosten)
            </label>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={edenaiValues.includes('calls')}
                onChange={() => toggleEdenaiValue('calls')}
              />
              Anzahl der Calls
            </label>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="period-days">
            Zeitraum für Verbrauch &amp; Calls
          </label>
          <select
            id="period-days"
            className={styles.select}
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
          >
            <option value={7}>Letzte 7 Tage</option>
            <option value={30}>Letzte 30 Tage</option>
            <option value={90}>Letzte 90 Tage</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="monitor-urls">
            Überwachte Webseiten
          </label>
          <textarea
            id="monitor-urls"
            className={styles.textarea}
            rows={6}
            placeholder={'Meine Seite | https://beispiel.de\nhttps://andere-seite.de'}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            spellCheck={false}
          />
          <div className={styles.hint}>
            Eine Zeile pro Webseite. Optional als <code>Titel | URL</code> – ohne
            Titel wird der Name aus der Domain abgeleitet.
          </div>
        </div>
      </section>

      {/* Sticky save button — only visible when there are unsaved changes. */}
      <div
        className={`${styles.saveBar} ${hasUnsaved ? styles.saveBarVisible : ''}`}
      >
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary} ${styles.saveButton}`}
          onClick={handleSaveMonitoring}
          disabled={!hasUnsaved}
        >
          Speichern
        </button>
      </div>
        </div>

        {/* Side navigation with the settings section topics. */}
        <nav className={styles.sidebar} aria-label="Einstellungen-Navigation">
          <span className={styles.sidebarTitle}>Themen</span>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={styles.sidebarItem}
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
