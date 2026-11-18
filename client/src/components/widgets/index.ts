// Widget registry. Maps widget ids to their React components.
// Widgets are rendered by the Dashboard based on their slot.

import type { ComponentType } from 'react';
import Clock from './Clock';
import Calendar from './Calendar';
import VikunjaTasks from './VikunjaTasks';

/** Props shared by every widget (each widget receives its config). */
export interface WidgetProps {
  config?: Record<string, unknown>;
}

/** Map of widget id -> component. */
export const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {
  clock: Clock,
  calendar: Calendar,
  vikunja: VikunjaTasks,
};

/** Available widget ids. */
export const widgetIds = Object.keys(widgetRegistry);

/** Look up a widget component by id, or null if unknown. */
export function getWidgetComponent(id: string): ComponentType<WidgetProps> | null {
  return widgetRegistry[id] ?? null;
}
