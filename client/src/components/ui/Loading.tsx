// A reusable, animated loading placeholder used across widgets.
// Renders a shimmering skeleton that adapts to the surrounding panel.

import styles from './Loading.module.css';

interface LoadingProps {
  /** Optional label shown as an animated text hint. */
  label?: string;
  /** When true, shows a centered circular spinner instead of a skeleton. */
  spinner?: boolean;
  /** Number of skeleton rows to render (for list-like widgets). */
  rows?: number;
}

/** A single shimmering skeleton block. */
function SkeletonBlock({ className }: { className?: string }) {
  return <span className={`${styles.block} ${className ?? ''}`} />;
}

export default function Loading({ label, spinner = false, rows = 1 }: LoadingProps) {
  if (spinner) {
    return (
      <div className={styles.spinnerWrap} role="status" aria-live="polite">
        <div className={styles.spinner} />
        {label && <span className={styles.label}>{label}</span>}
      </div>
    );
  }

  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-label={label ?? 'Lädt'}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <SkeletonBlock className={styles.avatar} />
          <div className={styles.column}>
            <SkeletonBlock className={styles.line} />
            <SkeletonBlock className={styles.lineShort} />
          </div>
        </div>
      ))}
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
