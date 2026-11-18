import { useCallback, useEffect, useState } from 'react';
import {
  disconnectProvider,
  fetchAuthStatus,
  OAUTH_START,
} from '../../api';
import { navigate } from '../../router';
import { useSettings, useWidgets } from '../../state/hooks';
import { widgetIds } from '../widgets';
import type { AuthStatus, ProviderStatus, Widget, WidgetConfig } from '../../types';
import styles from './Settings.module.css';

interface Message {
  type: 'success' | 'error';
  text: string;
}

const ACCENT_PRESETS = ['#e8862a', '#f59e0b', '#ef4444', '#a855f7', '#22c55e', '#3b82f6'];

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
  const { settings, save: saveSettings } = useSettings();
  const { widgets, saveWidget } = useWidgets();

  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const showMessage = useCallback((type: Message['type'], text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

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
    if (connected === 'google' || connected === 'microsoft') {
      showMessage('success', `${connected === 'google' ? 'Google' : 'Microsoft'} erfolgreich verbunden!`);
      // Clean up the query string without triggering a reload.
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      void loadAuth();
    }
  }, [loadAuth, showMessage]);

  const handleDisconnect = async (provider: 'google' | 'microsoft') => {
    try {
      await disconnectProvider(provider);
      showMessage('success', `${provider === 'google' ? 'Google' : 'Microsoft'} getrennt.`);
      void loadAuth();
    } catch (err) {
      showMessage('error', `Trennen fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleWidgetToggle = async (widget: Widget, enabled: boolean) => {
    try {
      await saveWidget(widget.id, { enabled });
      showMessage('success', `Widget "${widget.id}" ${enabled ? 'aktiviert' : 'deaktiviert'}.`);
    } catch (err) {
      showMessage('error', `Aktualisieren fehlgeschlagen: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleWidgetConfig = async (widget: Widget, config: WidgetConfig) => {
    try {
      await saveWidget(widget.id, { config });
      showMessage('success', 'Widget konfiguriert.');
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
  const microsoftStatus = auth ? providerStatusLabel(auth.microsoft) : null;
  const theme = settings.theme === 'light' ? 'light' : 'dark';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Einstellungen</h1>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
          ← Zurück zum Dashboard
        </button>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.messageSuccess : styles.messageError}>
          {message.text}
        </div>
      )}

      {/* Kalender */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Kalender</h2>
        <p className={styles.sectionHint}>
          Verbinde Google oder Microsoft, um deine Termine im Dashboard anzuzeigen.
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

        <div className={styles.row}>
          <span className={styles.rowLabel}>Microsoft Kalender</span>
          <div className={styles.rowActions}>
            {microsoftStatus && (
              <span className={`${styles.statusBadge} ${microsoftStatus.cls}`}>
                <span className={styles.statusDot} />
                {microsoftStatus.label}
              </span>
            )}
            {auth?.microsoft.connected ? (
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => handleDisconnect('microsoft')}
              >
                Trennen
              </button>
            ) : (
              <a
                className={`${styles.button} ${styles.buttonMicrosoft}`}
                href={OAUTH_START.microsoft}
                style={{ textDecoration: 'none' }}
              >
                Mit Microsoft verbinden
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
      <section className={styles.section}>
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
      <section className={styles.section}>
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
    </div>
  );
}
