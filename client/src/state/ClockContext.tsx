// Shared time source for all clock displays.
//
// The big Clock widget and the Calendar's "now" line previously each ran
// their own setInterval, so their Date values drifted apart by a few seconds
// and they rolled over to the next minute at slightly different moments.
//
// This provider maintains a single Date, ticked once per second, so every
// consumer renders the exact same time and changes minute at the same instant.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const TICK_MS = 1000;

export interface ClockContextValue {
  /** The single shared "now" Date, updated once per second. */
  now: Date;
}

const ClockContext = createContext<ClockContextValue | null>(null);

/** Provides the shared clock value to the whole dashboard. */
export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<ClockContextValue>(() => ({ now }), [now]);

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

/** Read the shared clock value. Must be used within a ClockProvider. */
export function useClock(): ClockContextValue {
  const ctx = useContext(ClockContext);
  if (!ctx) {
    throw new Error('useClock must be used within a ClockProvider');
  }
  return ctx;
}
