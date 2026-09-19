import { useCallback, useState } from 'react';
import type { AppSettings } from '../types';
import { loadSettings, saveSettings } from '../storage/settings';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(() => loadSettings());

  const setSettings = useCallback((next: AppSettings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  return { settings, setSettings };
}
