// Central state hooks for settings and widgets.
// Kept intentionally simple: each hook loads its data and exposes
// load/save helpers. Saving theme/accent also applies CSS variables.

import { useCallback, useEffect, useState } from 'react';
import {
  fetchSettings,
  fetchWidgets,
  updateSettings as apiUpdateSettings,
  updateWidget as apiUpdateWidget,
} from '../api';
import { applyTheme } from '../styles/theme';
import type { Settings, SettingsPatch, Widget, WidgetConfig } from '../types';

export interface UseSettingsResult {
  settings: Settings;
  loading: boolean;
  /** Reload settings from the backend and re-apply theme/accent. */
  refresh: () => Promise<void>;
  /** Persist a partial update; theme/accent are applied to the DOM. */
  save: (patch: SettingsPatch) => Promise<void>;
  /** Set one key without persisting (for controlled inputs that save later). */
  set: (patch: SettingsPatch) => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
      applyTheme(data.theme, data.accent);
    } catch (err) {
      console.error('Settings laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: SettingsPatch) => {
      await apiUpdateSettings(patch);
      setSettings((prev) => ({ ...prev, ...patch }));
      if (patch.theme !== undefined || patch.accent !== undefined) {
        applyTheme(
          patch.theme ?? settings.theme,
          patch.accent ?? settings.accent
        );
      }
    },
    [settings.theme, settings.accent]
  );

  const set = useCallback((patch: SettingsPatch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, loading, refresh, save, set };
}

export interface UseWidgetsResult {
  widgets: Widget[];
  loading: boolean;
  /** Reload widgets from the backend. */
  refresh: () => Promise<void>;
  /** Persist changes to a widget (enabled / config / slot). */
  saveWidget: (
    id: string,
    changes: { enabled?: boolean; config?: WidgetConfig; slot?: string }
  ) => Promise<void>;
  /** Update a widget's config locally (without persisting). */
  patchWidgetConfig: (id: string, config: WidgetConfig) => void;
}

export function useWidgets(): UseWidgetsResult {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWidgets();
      setWidgets(data);
    } catch (err) {
      console.error('Widgets laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveWidget = useCallback(
    async (
      id: string,
      changes: { enabled?: boolean; config?: WidgetConfig; slot?: string }
    ) => {
      await apiUpdateWidget(id, changes);
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                enabled: changes.enabled ?? w.enabled,
                config: changes.config ?? w.config,
                slot: changes.slot ?? w.slot,
              }
            : w
        )
      );
    },
    []
  );

  const patchWidgetConfig = useCallback((id: string, config: WidgetConfig) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, config } : w)));
  }, []);

  return { widgets, loading, refresh, saveWidget, patchWidgetConfig };
}

/** Convenience helper to find a widget by id. */
export function findWidget(widgets: Widget[], id: string): Widget | undefined {
  return widgets.find((w) => w.id === id);
}
