import { BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getAssetPath, PRELOAD_PATH, RENDERER_DIST } from '../paths';
import type { SettingsPage } from '../../shared/types';

let settingsWin: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

export function showSettingsWindow(page?: SettingsPage): void {
    if (settingsWin) {
        // The renderer listens for hashchange and switches page
        if (page) void settingsWin.webContents.executeJavaScript(`location.hash = '${page}'`);
        settingsWin.focus();
        return;
    }

    settingsWin = new BrowserWindow({
        width: 680,
        height: 500,
        show: false,
        title: 'Notion Quick Capture — Settings',
        icon: getAssetPath('icon.png'),
        resizable: true,
        minimizable: false,
        maximizable: false,
        minWidth: 600,
        minHeight: 440,
        maxWidth: 900,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: PRELOAD_PATH,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
        },
    });

    // Remove menu entirely
    settingsWin.setMenu(null);

    // Navigation lock
    settingsWin.webContents.on('will-navigate', (e) => e.preventDefault());
    settingsWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Load settings page
    if (VITE_DEV_SERVER_URL) {
        const base = VITE_DEV_SERVER_URL.trim().replace(/\/+$/, '');
        settingsWin.loadURL(`${base}/settings.html${page ? `#${page}` : ''}`);
    } else {
        settingsWin.loadFile(path.join(RENDERER_DIST, 'settings.html'), page ? { hash: page } : {});
    }

    settingsWin.once('ready-to-show', () => {
        settingsWin?.show();
    });

    settingsWin.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
            log.error(
                `[settingsWindow] Failed to load: ${validatedURL} - ${errorCode} ${errorDescription}`,
            );
        },
    );

    settingsWin.on('closed', () => {
        settingsWin = null;
    });

    log.info('[settingsWindow] Settings window created');
}

export function getSettingsWindow(): BrowserWindow | null {
    return settingsWin;
}
