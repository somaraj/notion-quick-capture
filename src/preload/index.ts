// src/preload/index.ts — contextBridge API (bridge only, no logic)
import { contextBridge, ipcRenderer } from 'electron';
import type {
    NotionBridge,
    CapturePayload,
    AppConfig,
    SyncStatus,
    UpdateState,
} from '../shared/types';

const bridge: NotionBridge = {
    // ── Auth ──
    auth: {
        getCapabilities: () => ipcRenderer.invoke('auth:getCapabilities'),
        startOAuth: () => ipcRenderer.invoke('auth:startOAuth'),
        saveToken: (token: string) => ipcRenderer.invoke('auth:saveToken', token),
        getAuthStatus: () => ipcRenderer.invoke('auth:getAuthStatus'),
        logout: (account: string) => ipcRenderer.invoke('auth:logout', account),
    },

    // ── Notion Data ──
    notion: {
        search: (query: string) => ipcRenderer.invoke('notion:search', query),
        getSchema: (databaseId: string) => ipcRenderer.invoke('notion:getSchema', databaseId),
        capture: (payload: CapturePayload) => ipcRenderer.invoke('notion:capture', payload),
        getUsers: () => ipcRenderer.invoke('notion:getUsers'),
    },

    // ── Config ──
    config: {
        get: <K extends keyof AppConfig>(key: K) => ipcRenderer.invoke('config:get', key),
        set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) =>
            ipcRenderer.invoke('config:set', key, value),
    },

    // ── Hotkey ──
    hotkey: {
        update: (accelerator: string) => ipcRenderer.invoke('hotkey:update', accelerator),
    },

    // ── Drafts ──
    drafts: {
        list: () => ipcRenderer.invoke('drafts:list'),
        retry: (id: string) => ipcRenderer.invoke('drafts:retry', id),
        delete: (id: string) => ipcRenderer.invoke('drafts:delete', id),
        syncNow: () => ipcRenderer.invoke('drafts:syncNow'),
        count: () => ipcRenderer.invoke('drafts:count'),
    },

    // ── Window ──
    window: {
        close: () => ipcRenderer.invoke('window:close'),
        openSettings: () => ipcRenderer.invoke('window:openSettings'),
        openExternal: (url: string) => ipcRenderer.invoke('window:openExternal', url),
        openAbout: () => ipcRenderer.invoke('window:openAbout'),
        setCaptureSize: (width: number, height: number, persist: boolean) =>
            ipcRenderer.invoke('window:setCaptureSize', width, height, persist),
    },

    // ── Updates ──
    updates: {
        getState: () => ipcRenderer.invoke('updates:getState'),
        check: () => ipcRenderer.invoke('updates:check'),
        download: () => ipcRenderer.invoke('updates:download'),
        install: () => ipcRenderer.invoke('updates:install'),
        openReleasePage: () => ipcRenderer.invoke('updates:openReleasePage'),
    },

    // ── Events (main → renderer) ──
    on: {
        draftCountChanged: (cb: (count: number) => void) => {
            ipcRenderer.on('drafts:countChanged', (_, count: number) => cb(count));
        },
        syncStatus: (cb: (status: SyncStatus) => void) => {
            ipcRenderer.on('sync:status', (_, status: SyncStatus) => cb(status));
        },
        configChanged: (cb: (key: string, value: unknown) => void) => {
            ipcRenderer.on('config:changed', (_, key: string, value: unknown) => cb(key, value));
        },
        captureReset: (cb: () => void) => {
            ipcRenderer.on('capture:reset', () => cb());
        },
        authChanged: (cb: () => void) => {
            ipcRenderer.on('auth:changed', () => cb());
        },
        updateState: (cb: (state: UpdateState) => void) => {
            ipcRenderer.on('updates:state', (_, state: UpdateState) => cb(state));
        },
    },
};

contextBridge.exposeInMainWorld('notionBridge', bridge);
