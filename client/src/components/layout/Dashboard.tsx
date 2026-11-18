import { useSettings, useWidgets } from '../../state/hooks';
import { SettingsContext } from '../../state/SettingsContext';
import { getWidgetComponent, type WidgetProps } from '../widgets';
import { navigate } from '../../router';
import styles from './Dashboard.module.css';

/** Render a widget into a slot panel with the appropriate wrapper. */
function WidgetPanel({
  widgetId,
  config,
  wrapperClass,
}: {
  widgetId: string;
  config?: Record<string, unknown>;
  wrapperClass: string;
}) {
  const Component = getWidgetComponent(widgetId);
  if (!Component) return null;

  const props: WidgetProps = { config };
  return (
    <div className={`${styles.panel} ${wrapperClass}`}>
      <Component {...props} />
    </div>
  );
}

export default function Dashboard() {
  const { settings, loading: settingsLoading } = useSettings();
  const { widgets, loading: widgetsLoading } = useWidgets();

  if (settingsLoading || widgetsLoading) {
    return <div className={styles.loading}>Lädt…</div>;
  }

  const topLeft = widgets.find((w) => w.id === 'clock' && w.enabled);
  const bottomLeft = widgets.find((w) => w.id === 'vikunja' && w.enabled);
  const right = widgets.find((w) => w.id === 'calendar' && w.enabled);

  return (
    <SettingsContext.Provider value={{ settings }}>
      <div className={styles.dashboard}>
        <div className={styles.leftColumn}>
          {topLeft && (
            <WidgetPanel
              widgetId={topLeft.id}
              config={topLeft.config}
              wrapperClass={styles.panelTopLeft}
            />
          )}
          {bottomLeft && (
            <WidgetPanel
              widgetId={bottomLeft.id}
              config={bottomLeft.config}
              wrapperClass={styles.panelBottomLeft}
            />
          )}
        </div>

        <div className={styles.rightColumn}>
          {right && (
            <WidgetPanel
              widgetId={right.id}
              config={right.config}
              wrapperClass={styles.panelRight}
            />
          )}
        </div>

        <button
          type="button"
          className={styles.settingsButton}
          onClick={() => navigate('/settings')}
          aria-label="Einstellungen öffnen"
          title="Einstellungen"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </SettingsContext.Provider>
  );
}
