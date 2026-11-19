import { useSettings, useWidgets } from '../../state/hooks';
import { SettingsContext } from '../../state/SettingsContext';
import { getWidgetComponent, type WidgetProps } from '../widgets';
import Loading from '../ui/Loading';
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
    return (
      <div className={styles.loading}>
        <Loading spinner label="Dashboard wird geladen" />
      </div>
    );
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
      </div>
    </SettingsContext.Provider>
  );
}
