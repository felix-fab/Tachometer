// React context that provides the global display settings
// (clock format, theme, accent) to widgets and layout components.

import { createContext, useContext } from 'react';
import type { Settings } from '../types';

export interface SettingsContextValue {
  settings: Settings;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: {},
});

/** Access global settings anywhere in the tree. */
export function useSettingsContext(): SettingsContextValue {
  return useContext(SettingsContext);
}
