// Shared settings state for all settings pages, so each page reads/writes the same values
import { reactive, ref } from 'vue';
import { applyTheme } from '../lib/theme';
import type { AppConfig } from '../../shared/types';

type EditableKey =
    | 'theme'
    | 'panelPosition'
    | 'panelWidth'
    | 'bodyFontSize'
    | 'launchAtLogin'
    | 'confirmOnClose'
    | 'schemaCacheTtl'
    | 'autoDownloadUpdates'
    | 'updateChannel';

export type EditableSettings = Pick<AppConfig, EditableKey>;

// Mirrors the defaults in src/main/store/appConfig.ts
export const DEFAULTS: EditableSettings = {
    theme: 'light',
    panelPosition: 'center',
    panelWidth: 600,
    bodyFontSize: 14,
    launchAtLogin: true,
    confirmOnClose: true,
    schemaCacheTtl: 300000,
    autoDownloadUpdates: true,
    updateChannel: 'stable',
};

const KEYS = Object.keys(DEFAULTS) as EditableKey[];

export const settings = reactive<EditableSettings>({ ...DEFAULTS });

/** Bumped on every successful write; drives the "Saved" indicator */
export const savedAt = ref(0);

// Shared with the capture and about windows (also follows OS light/dark changes live)
export { applyTheme } from '../lib/theme';

export async function loadSettings(): Promise<void> {
    const values = await Promise.all(KEYS.map((key) => window.notionBridge.config.get(key)));
    KEYS.forEach((key, i) => {
        (settings as Record<EditableKey, unknown>)[key] = values[i];
    });
    applyTheme(settings.theme);
}

export async function setSetting<K extends EditableKey>(
    key: K,
    value: AppConfig[K],
): Promise<void> {
    settings[key] = value;
    if (key === 'theme') applyTheme(value as string);
    await window.notionBridge.config.set(key, value);
    savedAt.value = Date.now();
}
