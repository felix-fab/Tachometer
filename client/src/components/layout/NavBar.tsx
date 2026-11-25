import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { navigate } from '../../router';
import { triggerRefresh } from '../../refresh';
import styles from './NavBar.module.css';

export interface NavItem {
  path: string;
  label: string;
}

/** Floating FAB bottom-right: opens a slide-in nav panel (which also
    contains the refresh button). */
export default function NavBar({
  items,
  activePath,
}: {
  items: NavItem[];
  activePath: string;
}) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const close = () => setOpen(false);

  const handleNavigate = (path: string) => {
    close();
    navigate(path);
  };

  const handleRefresh = () => {
    // Brief spin feedback on the icon, then fire the refresh event.
    setSpinning(true);
    triggerRefresh();
    window.setTimeout(() => setSpinning(false), 600);
  };

  // Close the menu with the Escape key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll while the menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Backdrop + panel are rendered via a portal straight to <body> so they are
  // never trapped inside the top bar's stacking context (backdrop-filter).
  const menu = open
    ? createPortal(
        <>
          <div className={styles.backdrop} onClick={close} aria-hidden="true" />
          <div
            id="nav-menu"
            className={styles.panel}
            data-scrollable
            role="dialog"
            aria-label="Hauptnavigation"
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Navigation</span>
              <button
                type="button"
                className={styles.closeButton}
                onClick={close}
                aria-label="Menü schließen"
              >
                ✕
              </button>
            </div>

            <nav className={styles.nav}>
              {items.map((item) => {
                const active = activePath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className={styles.panelFooter}>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={handleRefresh}
              >
                <svg
                  className={`${styles.refreshIcon} ${spinning ? styles.refreshSpinning : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Daten aktualisieren
              </button>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <button
        type="button"
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
        aria-expanded={open}
        aria-controls="nav-menu"
      >
        <span className={styles.burgerLines}>
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarOpen1 : ''}`} />
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarOpen2 : ''}`} />
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarOpen3 : ''}`} />
        </span>
      </button>

      {menu}
    </>
  );
}
