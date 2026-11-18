import { navigate } from '../../router';
import styles from './TabBar.module.css';

export interface TabDef {
  path: string;
  label: string;
}

/** Top-level tab bar for switching between Dashboard and Stats. */
export default function TabBar({
  tabs,
  activePath,
}: {
  tabs: TabDef[];
  activePath: string;
}) {
  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Hauptnavigation">
      <div className={styles.tabs}>
        {tabs.map((tab) => {
          const active = activePath === tab.path;
          return (
            <button
              key={tab.path}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => navigate(tab.path)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
