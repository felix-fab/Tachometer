import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchVikunjaConfigured, fetchVikunjaTasks } from '../../api';
import type { VikunjaTask } from '../../types';
import type { WidgetProps } from './index';
import Loading from '../ui/Loading';
import { REFRESH } from '../../constants';
import { onRefresh } from '../../refresh';
import styles from './VikunjaTasks.module.css';

interface VikunjaTasksProps extends WidgetProps {}

/** True when the value is a usable date (not empty and not Vikunja's zero-value). */
function isValidDate(value: string | null): value is string {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  // Vikunja uses Go's zero-value (year 1) for "no date".
  return date.getUTCFullYear() >= 1970;
}

/** Format a due date as a short German date, e.g. "18.11." */
function formatDueDate(value: string): string {
  if (!isValidDate(value)) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

/** Format a date as a full German date, e.g. "Mi., 18.11.2026". */
function formatFullDate(value: string | null): string {
  if (!isValidDate(value)) return '';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function isOverdue(dueDate: string): boolean {
  if (!isValidDate(dueDate)) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/** Human-readable priority label. */
function priorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return 'Niedrig';
    case 2:
      return 'Mittel';
    case 3:
      return 'Hoch';
    default:
      return 'Keine';
  }
}

export default function VikunjaTasks(_props: VikunjaTasksProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<VikunjaTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VikunjaTask | null>(null);

  const closePopup = useCallback(() => setSelected(null), []);

  // Close the popup with the Escape key.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const load = useCallback(async () => {
    try {
      const { configured: cfg } = await fetchVikunjaConfigured();
      setConfigured(cfg);
      if (!cfg) {
        setTasks([]);
        setError(null);
        return;
      }
      const result = await fetchVikunjaTasks(5);
      setTasks(result.tasks);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      if (msg === 'vikunja_not_configured') {
        setConfigured(false);
        setTasks([]);
      } else {
        setError(msg);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH.vikunjaMs);
    const unsub = onRefresh(() => void load());
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [load]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        Vikunja
      </div>

      {configured === false ? (
        <p className={styles.hint}>
          Vikunja nicht konfiguriert. Trage <code>VIKUNJA_URL</code> und{' '}
          <code>VIKUNJA_TOKEN</code> in <code>server/.env</code> ein.
        </p>
      ) : configured === null ? (
        <Loading rows={4} label="Tasks werden geladen" />
      ) : tasks.length === 0 ? (
        <p className={styles.hint}>Keine offenen Tasks</p>
      ) : (
        <ul className={styles.list} data-scrollable>
          {tasks.map((task) => {
            const hasDue = isValidDate(task.dueDate);
            const overdue = hasDue && isOverdue(task.dueDate!);
            return (
              <li key={task.id} className={styles.taskWrap}>
                <button
                  type="button"
                  className={styles.task}
                  onClick={() => setSelected(task)}
                  title={`Details zu "${task.title}"`}
                >
                  <div className={styles.taskTitle}>{task.title}</div>
                  <div className={styles.taskMeta}>
                    {task.project ? (
                      <span className={styles.project}>
                        <span
                          className={styles.projectDot}
                          style={task.projectColor ? { background: task.projectColor } : undefined}
                        />
                        {task.project}
                      </span>
                    ) : null}
                    {hasDue ? (
                      <span
                        className={`${styles.due} ${overdue ? styles.dueOverdue : ''}`}
                      >
                        <svg
                          className={styles.dueIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {overdue
                          ? `Überfällig · ${formatDueDate(task.dueDate!)}`
                          : formatDueDate(task.dueDate!)}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <div className={styles.error}>Fehler: {error}</div>}

      {selected &&
        createPortal(
          <div className={styles.overlay} onClick={closePopup}>
            <div
              className={styles.popup}
              role="dialog"
              aria-modal="true"
              aria-label="Task-Details"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.popupTop}>
                {selected.project && (
                  <span className={styles.popupProject}>
                    <span
                      className={styles.popupProjectDot}
                      style={
                        selected.projectColor
                          ? { background: selected.projectColor }
                          : undefined
                      }
                    />
                    {selected.project}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.popupClose}
                  onClick={closePopup}
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>

              <h3 className={styles.popupTitle}>{selected.title}</h3>

              <dl className={styles.popupDetails}>
                {selected.description && (
                  <div className={styles.popupBlock}>
                    <dt>Beschreibung</dt>
                    <dd className={styles.popupDescription}>{selected.description}</dd>
                  </div>
                )}
                {isValidDate(selected.dueDate) && (
                  <div className={styles.popupRow}>
                    <dt>Fällig</dt>
                    <dd className={isOverdue(selected.dueDate!) ? styles.dueOverdue : undefined}>
                      {formatFullDate(selected.dueDate)}
                      {isOverdue(selected.dueDate!) ? ' (überfällig)' : ''}
                    </dd>
                  </div>
                )}
                <div className={styles.popupRow}>
                  <dt>Priorität</dt>
                  <dd>{priorityLabel(selected.priority)}</dd>
                </div>
                {selected.assignees.length > 0 && (
                  <div className={styles.popupRow}>
                    <dt>Zugewiesen an</dt>
                    <dd>{selected.assignees.join(', ')}</dd>
                  </div>
                )}
                {selected.labels.length > 0 && (
                  <div className={styles.popupBlock}>
                    <dt>Labels</dt>
                    <dd className={styles.popupLabels}>
                      {selected.labels.map((label) => (
                        <span key={label} className={styles.popupLabel}>
                          {label}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {isValidDate(selected.createdAt) && (
                  <div className={styles.popupRow}>
                    <dt>Erstellt</dt>
                    <dd>{formatFullDate(selected.createdAt)}</dd>
                  </div>
                )}
                <div className={styles.popupRow}>
                  <dt>Kennung</dt>
                  <dd>{selected.identifier}</dd>
                </div>
              </dl>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
