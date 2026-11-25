import { useEffect } from 'react';
import Dashboard from './components/layout/Dashboard';
import Settings from './components/layout/Settings';
import Stats from './components/layout/Stats';
import NavBar from './components/layout/NavBar';
import { useHashRoute } from './router';
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

  useEffect(() => {
    // Apply sensible theme defaults before settings load to avoid a flash.
    applyTheme();
  }, []);

  // Map the hash route to the active tab path.
  const activePath = route === '/stats' ? '/stats' : route === '/settings' ? '/settings' : '/';

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
