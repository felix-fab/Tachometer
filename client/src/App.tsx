import { useEffect, useRef } from 'react';
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

export default function App() {
  const route = useHashRoute();
  const { settings } = useSettings();

  useEffect(() => {
    // Apply sensible theme defaults before settings load to avoid a flash.
    applyTheme();
    // Kiosk mode (Raspberry Pi): hide the mouse cursor via CSS until the
    // first real interaction, because Chromium/unclutter otherwise keep the
    // pointer visible until the user clicks.
    if (new URLSearchParams(window.location.search).get('kiosk') === '1') {
      document.documentElement.setAttribute('data-kiosk', '');
    }
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

  // Keep the current path in a ref so the rotation timer (set up once below)
  // always sees the latest route. The interval must NOT depend on the active
  // path, otherwise it would be torn down and restarted on every switch,
  // resetting the countdown and causing unreliable rotation timing.
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  useEffect(() => {
    if (!autoRotateEnabled) return;
    const id = window.setInterval(() => {
      const current = activePathRef.current;
      if (current === '/settings') return;
      navigate(current === '/stats' ? '/' : '/stats');
    }, autoRotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoRotateEnabled, autoRotateSeconds]);

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
