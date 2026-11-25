import { useCallback, useEffect } from 'react';
import Dashboard from './components/layout/Dashboard';
import Settings from './components/layout/Settings';
import Stats from './components/layout/Stats';
import NavBar from './components/layout/NavBar';
import { useHashRoute, navigate } from './router';
import { useSettings } from './state/hooks';
import { applyTheme } from './styles/theme';
import './styles/global.css';
import styles from './App.module.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/stats', label: 'Stats' },
  { path: '/settings', label: 'Einstellungen' },
];

/** Toggle between dashboard and stats (auto-rotation). */
function toggleView(current: string): string {
  return current === '/stats' ? '/' : '/stats';
}

export default function App() {
  const route = useHashRoute();
  const { settings } = useSettings();

  useEffect(() => {
    // Apply sensible theme defaults before settings load to avoid a flash.
    applyTheme();
  }, []);

  // Map the hash route to the active tab path.
  const activePath = route === '/stats' ? '/stats' : route === '/settings' ? '/settings' : '/';

  // Auto-rotation: switch between dashboard and stats every N seconds when
  // enabled. Only rotates while on dashboard/stats (not on settings).
  const autoRotateEnabled = settings.auto_rotate_enabled === true;
  const autoRotateSeconds = Math.max(
    5,
    Math.min(600, Number(settings.auto_rotate_seconds) || 30)
  );

  const rotate = useCallback(() => {
    if (activePath === '/settings') return;
    navigate(toggleView(activePath));
  }, [activePath]);

  useEffect(() => {
    if (!autoRotateEnabled) return;
    const id = window.setInterval(rotate, autoRotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoRotateEnabled, autoRotateSeconds, rotate]);

  return (
    <div className={styles.shell}>
      <NavBar items={NAV_ITEMS} activePath={activePath} />
      {/* Keep all views mounted and hide the inactive ones so their
          loaded data is cached across tab switches (no reload). */}
      <main className={styles.content}>
        <div className={styles.view} hidden={activePath !== '/'}>
          <Dashboard />
        </div>
        <div className={styles.view} hidden={activePath !== '/stats'}>
          <Stats />
        </div>
        <div className={styles.view} hidden={activePath !== '/settings'}>
          <Settings />
        </div>
      </main>
    </div>
  );
}
