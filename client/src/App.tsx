import { useEffect } from 'react';
import Dashboard from './components/layout/Dashboard';
import Settings from './components/layout/Settings';
import Stats from './components/layout/Stats';
import TabBar from './components/layout/TabBar';
import { useHashRoute } from './router';
import { applyTheme } from './styles/theme';
import './styles/global.css';
import styles from './App.module.css';

const TABS = [
  { path: '/', label: 'Dashboard' },
  { path: '/stats', label: 'Stats' },
];

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    // Apply sensible theme defaults before settings load to avoid a flash.
    applyTheme();
  }, []);

  // Settings is a dedicated full-screen page without tabs.
  if (route === '/settings') return <Settings />;

  const activePath = route === '/stats' ? '/stats' : '/';

  return (
    <div className={styles.shell}>
      <TabBar tabs={TABS} activePath={activePath} />
      <main className={styles.content}>{activePath === '/stats' ? <Stats /> : <Dashboard />}</main>
    </div>
  );
}
