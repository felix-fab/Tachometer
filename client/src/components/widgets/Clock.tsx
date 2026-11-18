import { useEffect, useMemo, useState } from 'react';
import { useSettingsContext } from '../../state/SettingsContext';
import type { WidgetProps } from './index';
import styles from './Clock.module.css';

interface ClockProps extends WidgetProps {}

/** Format the current time as h:mm AM/PM with optional seconds. */
function formatTime(date: Date, seconds: boolean): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  let hour = '';
  let minute = '';
  let dayPeriod = '';
  for (const part of parts) {
    if (part.type === 'hour') hour = part.value;
    else if (part.type === 'minute') minute = part.value;
    else if (part.type === 'dayPeriod') dayPeriod = part.value;
  }

  const sec = seconds ? `:${String(date.getSeconds()).padStart(2, '0')}` : '';
  const period = dayPeriod ? ` ${dayPeriod}` : '';
  return `${hour}:${minute}${sec}${period}`;
}

/** Format the full date in German, e.g. "Mittwoch, 18. November 2026". */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function Clock(_props: ClockProps) {
  const { settings } = useSettingsContext();
  const clockSeconds = settings.clock_seconds === true;

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Update every second when seconds are shown, otherwise every 30s.
    const intervalMs = clockSeconds ? 1000 : 30000;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [clockSeconds]);

  const time = useMemo(() => formatTime(now, clockSeconds), [now, clockSeconds]);
  const date = useMemo(() => formatDate(now), [now]);

  return (
    <div className={styles.clock}>
      <div className={styles.time}>{time}</div>
      <div className={styles.date}>{date}</div>
    </div>
  );
}
