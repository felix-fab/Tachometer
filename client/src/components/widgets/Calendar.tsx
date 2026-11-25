import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCalendar } from '../../api';
import type { CalendarEvent } from '../../types';
import type { WidgetProps } from './index';
import Loading from '../ui/Loading';
import { REFRESH } from '../../constants';
import { onRefresh } from '../../refresh';
import styles from './Calendar.module.css';

interface CalendarProps extends WidgetProps {}

const NOW_INTERVAL_MS = 60_000;

/** Minutes in a full day. */

/** Timeline time window (in minutes from midnight): 07:00 – 24:00. */
const WINDOW_START_MIN = 7 * 60;
const WINDOW_END_MIN = 24 * 60;
const WINDOW_MINUTES = WINDOW_END_MIN - WINDOW_START_MIN;

/** A positioned slot within the timeline for one event. */
interface PlacedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  isNow: boolean;
  startLabel: string;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** Clamp a minute-of-day value into the displayed time window. */
function clampToWindow(minutes: number): number {
  return Math.min(WINDOW_END_MIN, Math.max(WINDOW_START_MIN, minutes));
}

/** Percent of the timeline reserved at the bottom so the 12 AM label is not clipped. */
const TIMELINE_BOTTOM_RESERVE = 3;

/** Convert a minute-of-day to a timeline percentage (0–100). */
function minutePosition(minutes: number): number {
  const clamped = clampToWindow(minutes);
  return (
    ((clamped - WINDOW_START_MIN) / WINDOW_MINUTES) *
    (100 - TIMELINE_BOTTOM_RESERVE)
  );
}

/** Position of a time within the displayed window, as a percentage (0–100). */
function timePosition(date: Date): number {
  return minutePosition(minutesOfDay(date));
}

/** Exact minute-of-day (0–1440) of a Date, including seconds fraction. */
function exactMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** Hour markers (07:00 – 24:00) for the timeline gutter, in AM/PM. */
function buildHourMarks(): { position: number; label: string }[] {
  const marks: { position: number; label: string }[] = [];
  for (let m = WINDOW_START_MIN; m <= WINDOW_END_MIN; m += 60) {
    const hour24 = (Math.floor(m / 60) + 24) % 24;
    const period = hour24 < 12 ? 'AM' : 'PM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    marks.push({
      position: minutePosition(m),
      label: `${hour12} ${period}`,
    });
  }
  return marks;
}

/** Format the time (h:mm AM/PM) for a non-all-day event. */
function formatTime(start: string | null): string {
  if (!start) return '';
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Format a timestamp as a full date + time (e.g. "Wed, 18.11.2026, 9:30 AM"). */
function formatDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Human-readable start–end range for the popup. */
function formatRange(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztägig';
  const start = formatDateTime(event.start);
  const end = formatDateTime(event.end);
  if (!start) return '–';
  return end && end !== start ? `${start} – ${end}` : start;
}

/** Day key (YYYY-MM-DD) for a given local date. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** True when the event occurs (at least partially) on the given local date. */
function overlapsDate(event: CalendarEvent, date: Date): boolean {
  const day = dayKey(date);
  const startDay = event.start ? dayKey(new Date(event.start)) : day;
  const endDay = event.end ? dayKey(new Date(event.end)) : startDay;
  return day >= startDay && day <= endDay;
}

/** Resolve the display color for an event. */
function eventColor(event: CalendarEvent): string {
  if (event.color) return event.color;
  return 'var(--google)';
}

/**
 * Pack overlapping timed events into side-by-side columns so none is hidden.
 * Mutually exclusive events share a column; overlapping events get their own.
 * Returns each item with `col`, `cols` (total columns) and relative `width`.
 */
function layoutColumns<T extends { startPos: number; endPos: number }>(
  items: T[]
): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.startPos - b.startPos);
  const columnEnds: number[] = [];
  const result: (T & { col: number })[] = [];

  for (const item of sorted) {
    let col = columnEnds.findIndex((end) => end <= item.startPos);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[col] = Math.max(columnEnds[col], item.endPos);
    result.push({ ...item, col });
  }

  const maxCols = result.reduce((m, r) => Math.max(m, r.col + 1), 0);
  return result.map((r) => ({ ...r, cols: maxCols }));
}

export default function Calendar({ config }: CalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const closePopup = useCallback(() => setSelectedEvent(null), []);

  // Close the popup with the Escape key.
  useEffect(() => {
    if (!selectedEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEvent]);

  const maxEvents = Math.max(1, Number(config?.maxEvents) || 8);

  // Keep the "now" line current (refresh every minute).
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), NOW_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await fetchCalendar(maxEvents);
      setEvents(result.events);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [maxEvents]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH.calendarMs);
    const unsub = onRefresh(() => void load());
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [load]);

  const { allDayEvents, placed, nowPosition, hourMarks, empty } = useMemo(() => {
    const today = new Date();
    const nowPosition = timePosition(today);

    const todays = events.filter((e) => overlapsDate(e, today)).slice(0, maxEvents);

    const allDay = todays.filter((e) => e.allDay);
    const timed = todays.filter((e) => !e.allDay);

    const hourMarks = buildHourMarks();

    // Build a positioned list, with overlap packing.
    const placed: PlacedEvent[] = [];

    const withRange = timed
      .map((event) => {
        const start = event.start ? new Date(event.start) : null;
        const end = event.end ? new Date(event.end) : null;
        if (!start || Number.isNaN(start.getTime())) return null;
        // Position events exactly at their real start/end time.
        const startMin = clampToWindow(exactMinutesOfDay(start));
        let startPos = minutePosition(startMin);
        let endPos = end && !Number.isNaN(end.getTime())
          ? minutePosition(clampToWindow(exactMinutesOfDay(end)))
          : startPos + (60 / WINDOW_MINUTES) * (100 - TIMELINE_BOTTOM_RESERVE);
        // Clamp to the window (07:00–24:00).
        startPos = Math.max(0, startPos);
        endPos = Math.min(100, endPos);
        return {
          event,
          startPos,
          endPos,
          top: startPos,
          height: Math.max(endPos - startPos, 1.5),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.startPos - b.startPos);

    const packed = layoutColumns(withRange);
    for (const p of packed) {
      placed.push({
        event: p.event,
        top: p.top,
        height: p.height,
        left: (p.col / p.cols) * 100,
        width: 100 / p.cols,
        isNow: nowPosition >= p.top && nowPosition <= p.top + p.height,
        startLabel: formatTime(p.event.start),
      });
    }

    return {
      allDayEvents: allDay,
      placed,
      nowPosition,
      hourMarks,
      empty: todays.length === 0,
    };
  }, [events, maxEvents, now]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>Heutige Termine</div>
      </div>

      {loading && events.length === 0 ? (
        <Loading rows={3} label="Termine werden geladen" />
      ) : (
        <div className={styles.timelineWrap} data-scrollable>
          {empty && (
            <p className={styles.emptyBanner}>Keine Termine für heute</p>
          )}

          {allDayEvents.length > 0 && (
            <div className={styles.allDay}>
              <div className={styles.allDayList}>
                {allDayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={styles.allDayChip}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <span
                      className={styles.chipDot}
                      style={{ background: eventColor(event) }}
                    />
                    {event.summary}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={styles.timeline}
            style={{ '--now': `${nowPosition}%` } as React.CSSProperties}
          >
            {hourMarks.map((mark) => (
              <div
                key={mark.label}
                className={styles.hourMark}
                style={{ top: `${mark.position}%` }}
              >
                <span className={styles.hourLabel}>{mark.label}</span>
              </div>
            ))}

            <div className={styles.lane} style={{ left: '3.25rem' }}>
              {placed.map((p) => (
                <button
                  key={p.event.id}
                  type="button"
                  className={`${styles.event} ${p.isNow ? styles.eventNow : ''}`}
                  style={{
                    top: `${p.top}%`,
                    height: `${p.height}%`,
                    left: `${p.left}%`,
                    width: `${p.width}%`,
                  }}
                  title={p.event.summary}
                  onClick={() => setSelectedEvent(p.event)}
                >
                  <div
                    className={styles.eventColorBar}
                    style={{ background: eventColor(p.event) }}
                  />
                  <div className={styles.eventBody}>
                    <div className={styles.eventSummary}>{p.event.summary}</div>
                    <div className={styles.eventTime}>{p.startLabel}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className={styles.nowLine}>
              <span className={styles.nowDot} />
              <span className={styles.nowLabel}>
                Jetzt · {formatTime(now.toISOString())}
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedEvent &&
        createPortal(
          <div className={styles.overlay} onClick={closePopup}>
            <div
              className={styles.popup}
              role="dialog"
              aria-modal="true"
              aria-label="Termindetails"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.popupTop}>
                <div className={styles.popupHeader}>
                  <span
                    className={styles.popupDot}
                    style={{ background: eventColor(selectedEvent) }}
                  />
                  <span className={styles.popupLane}>Privat</span>
                </div>
                <button
                  type="button"
                  className={styles.popupClose}
                  onClick={closePopup}
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>

              <h3 className={styles.popupTitle}>{selectedEvent.summary}</h3>

              <dl className={styles.popupDetails}>
                <div className={styles.popupRow}>
                  <dt>Zeit</dt>
                  <dd>{formatRange(selectedEvent)}</dd>
                </div>
                {selectedEvent.location && (
                  <div className={styles.popupRow}>
                    <dt>Ort</dt>
                    <dd>{selectedEvent.location}</dd>
                  </div>
                )}
                <div className={styles.popupRow}>
                  <dt>Kalender</dt>
                  <dd>{selectedEvent.calendarName || 'Google Kalender'}</dd>
                </div>
              </dl>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
