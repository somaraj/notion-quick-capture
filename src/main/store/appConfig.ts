// src/main/store/appConfig.ts — Typed electron-store for non-secret configuration
import Store from 'electron-store';
import type { AppConfig } from '../../shared/types';

const schema: Store.Schema<AppConfig> = {
    globalHotkey: {
        type: 'string' as const,
        default: 'CommandOrControl+Shift+N',
    },
    defaultDestination: {
        type: ['object', 'null'] as const,
        default: null,
    },
    launchAtLogin: {
        type: 'boolean' as const,
        default: true,
    },
    panelPosition: {
        type: 'string' as const,
        enum: ['top', 'center', 'bottom'],
        default: 'center',
    },
    panelWidth: {
        type: 'number' as const,
        minimum: 400,
        maximum: 800,
        default: 600,
    },
    panelHeight: {
        type: 'number' as const,
        minimum: 360,
        maximum: 1200,
        default: 600,
    },
    theme: {
        type: 'string' as const,
        enum: ['system', 'light', 'dark'],
        default: 'light',
    },
    bodyFontSize: {
        type: 'number' as const,
        minimum: 12,
        maximum: 18,
        default: 14,
    },
    schemaCacheTtl: {
        type: 'number' as const,
        default: 300000,
    },
    offlineDrafts: {
        type: 'boolean' as const,
        default: true,
    },
    confirmOnClose: {
        type: 'boolean' as const,
        default: true,
    },
    activeWorkspace: {
        type: ['string', 'null'] as const,
        default: null,
    },
    activeWorkspaceName: {
        type: ['string', 'null'] as const,
        default: null,
    },
    recentDestinations: {
        type: 'array' as const,
        default: [],
        items: {
            type: 'object' as const,
            properties: {
                id: { type: 'string' as const },
                type: { type: 'string' as const, enum: ['page', 'database'] },
                title: { type: 'string' as const },
                icon: { type: 'string' as const },
            },
            required: ['id', 'type', 'title'],
        },
    },
    pinnedDestinations: {
        type: 'array' as const,
        default: [],
        items: {
            type: 'object' as const,
            properties: {
                id: { type: 'string' as const },
                type: { type: 'string' as const, enum: ['page', 'database'] },
                title: { type: 'string' as const },
                icon: { type: 'string' as const },
            },
            required: ['id', 'type', 'title'],
        },
    },
    autoDownloadUpdates: {
        type: 'boolean' as const,
        default: true,
    },
    updateChannel: {
        type: 'string' as const,
        enum: ['stable', 'beta'],
        default: 'stable',
    },
    lastRunVersion: {
        type: ['string', 'null'] as const,
        default: null,
    },
};

const store = new Store<AppConfig>({ schema });

export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return store.get(key);
}

export function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    store.set(key, value);
}

export function getFullConfig(): AppConfig {
    return store.store;
}

export { store as appStore };
